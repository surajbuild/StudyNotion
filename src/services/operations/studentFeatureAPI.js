import toast from "react-hot-toast";
import { studentEndpoints } from "../apis";
import { apiConnector } from "../apiconnector";
import rzpLogo from "../../assets/Logo/rzp_logo.png";
import { setPaymentLoading } from "../../slices/courseSlice";
import { removeFromCart, resetCart } from "../../slices/cartSlice";
import { setUser } from "../../slices/profileSlice";
import { fetchUserCart } from "./cartAPI";

const {
    COURSE_PAYMENT_API,
    COURSE_VERIFY_API,
    MARK_PAYMENT_FAILED_API,
    ENROLL_FREE_COURSE_API,
    SEND_PAYMENT_SUCCESS_EMAIL_API,
    GET_ORDER_HISTORY_API,
    GET_ORDER_DETAILS_API,
} = studentEndpoints;

function loadScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;

        script.onload = () => {
            resolve(true);
        };
        script.onerror = () => {
            resolve(false);
        };

        document.body.appendChild(script);
    });
}

async function reportPaymentFailure(razorpayOrderId, status, reason, token) {
    if (!razorpayOrderId || !token) return;
    try {
        await apiConnector(
            "POST",
            MARK_PAYMENT_FAILED_API,
            {
                razorpay_order_id: razorpayOrderId,
                status,
                reason,
            },
            {
                Authorization: `Bearer ${token}`,
            }
        );
    } catch {
        // Non-blocking audit call
    }
}

export async function buyCourse(token, courses, userDetails, navigate, dispatch) {
    const toastId = toast.loading("Loading...");
    try {
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");

        if (!res) {
            toast.error("RazorPay SDK failed to load");
            return;
        }

        // Initiate authoritative server-side order (PENDING in MongoDB)
        const orderResponse = await apiConnector(
            "POST",
            COURSE_PAYMENT_API,
            { courses },
            {
                Authorization: `Bearer ${token}`,
            }
        );
        if (!orderResponse.data.success) {
            throw new Error(orderResponse.data.message);
        }

        const orderData = orderResponse.data.message || orderResponse.data;
        let paymentAttempted = false;

        const options = {
            key: process.env.REACT_APP_RAZORPAY_KEY,
            currency: orderData.currency || "INR",
            amount: `${orderData.amount}`,
            order_id: orderData.id,
            name: "Studynotion",
            description: "Thank You for Purchasing the Course",
            image: rzpLogo,
            prefill: {
                name: `${userDetails.firstName}`,
                email: userDetails.email,
            },
            modal: {
                ondismiss: function () {
                    if (!paymentAttempted) {
                        reportPaymentFailure(
                            orderData.id,
                            "CANCELLED",
                            "Payment cancelled by student",
                            token
                        );
                        toast.error("Payment cancelled");
                    }
                },
            },
            handler: function (response) {
                paymentAttempted = true;
                // Strictly verify payment on backend BEFORE sending receipt email or granting access
                verifyPayment(
                    {
                        ...response,
                        courses,
                        amount: orderData.amount,
                        currency: orderData.currency || "INR",
                    },
                    token,
                    navigate,
                    dispatch,
                    orderData.amount
                );
            },
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        paymentObject.on("payment.failed", function (response) {
            paymentAttempted = true;
            const reason = response?.error?.description || "Payment failed";
            reportPaymentFailure(orderData.id, "FAILED", reason, token);
            toast.error(reason || "Oops, payment failed");
        });
    } catch (error) {
        const msg =
            error?.response?.data?.message || error?.message || "Could not make Payment";
        toast.error(msg, { id: toastId });
    } finally {
        toast.dismiss(toastId);
    }
}

async function sendPaymentSuccessEmail(response, amount, token) {
    try {
        await apiConnector(
            "POST",
            SEND_PAYMENT_SUCCESS_EMAIL_API,
            {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                amount,
            },
            {
                Authorization: `Bearer ${token}`,
            }
        );
    } catch (error) {
        console.log("PAYMENT SUCCESS EMAIL ERROR...", error);
    }
}

// Verify payment strictly on backend before confirming success or updating cart
async function verifyPayment(bodyData, token, navigate, dispatch, amountForEmail) {
    const toastId = toast.loading("Verifying Payment...");
    dispatch(setPaymentLoading(true));
    try {
        const response = await apiConnector("POST", COURSE_VERIFY_API, bodyData, {
            Authorization: `Bearer ${token}`,
        });

        if (!response.data.success) {
            throw new Error(response.data.message);
        }

        // Send receipt email only after confirmed backend verification (and skip on duplicate replay)
        if (!response.data.alreadyProcessed && amountForEmail) {
            sendPaymentSuccessEmail(bodyData, amountForEmail, token);
        }

        // Synchronize cart from authoritative MongoDB state (enrolled courses already pruned server-side)
        const syncedCart = await fetchUserCart(token, dispatch);
        if (!syncedCart) {
            dispatch(resetCart());
        }

        toast.success("Payment successful, You are added to the course");
        navigate("/dashboard/enrolled-courses");
    } catch (error) {
        const msg =
            error?.response?.data?.message || error?.message || "Could not verify Payment";
        toast.error(msg);
    } finally {
        toast.dismiss(toastId);
        dispatch(setPaymentLoading(false));
    }
}

// Enroll directly in free (₹0) course(s) without Razorpay checkout
export async function enrollFreeCourse(token, courses, userDetails, navigate, dispatch) {
    const toastId = toast.loading("Enrolling in course...");
    dispatch(setPaymentLoading(true));
    try {
        const courseList = Array.isArray(courses) ? courses : [courses];
        const response = await apiConnector(
            "POST",
            ENROLL_FREE_COURSE_API,
            { courses: courseList },
            {
                Authorization: `Bearer ${token}`,
            }
        );

        if (!response.data?.success) {
            throw new Error(response.data?.message || "Could not enroll in free course");
        }

        // Remove enrolled free courses from local Redux cart (server already pruned DB cart)
        courseList.forEach((courseId) => dispatch(removeFromCart(courseId)));

        // Sync enrolled course IDs into Redux user & localStorage
        if (userDetails) {
            const existingCourses = Array.isArray(userDetails.courses) ? userDetails.courses : [];
            const mergedCourses = [
                ...new Set([...existingCourses.map(String), ...courseList.map(String)]),
            ];
            const updatedUser = { ...userDetails, courses: mergedCourses };
            dispatch(setUser(updatedUser));
            try {
                localStorage.setItem("user", JSON.stringify(updatedUser));
            } catch {
                // Ignore storage quota errors
            }
        }

        toast.success(response.data.message || "Successfully enrolled in free course");
        navigate("/dashboard/enrolled-courses");
        return true;
    } catch (error) {
        const msg =
            error?.response?.data?.message ||
            error?.message ||
            "Could not enroll in free course";
        toast.error(msg);
        return false;
    } finally {
        toast.dismiss(toastId);
        dispatch(setPaymentLoading(false));
    }
}

// Fetch paginated Order History for the authenticated student
export async function fetchOrderHistory(token, params = {}) {
    const cleanParams = {};
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== "") {
            cleanParams[key] = String(val).trim();
        }
    });

    try {
        const response = await apiConnector(
            "GET",
            GET_ORDER_HISTORY_API,
            null,
            { Authorization: `Bearer ${token}` },
            cleanParams
        );
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Failed to load order history");
        }
        return response.data.data;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Could not load order history";
        throw new Error(message);
    }
}

// Fetch details for a single order owned by the authenticated student
export async function fetchOrderDetails(token, orderId) {
    try {
        const response = await apiConnector(
            "GET",
            `${GET_ORDER_DETAILS_API}/${encodeURIComponent(orderId)}`,
            null,
            { Authorization: `Bearer ${token}` }
        );
        if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Failed to load order details");
        }
        return response.data.data?.order;
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            error?.message ||
            "Could not load order details";
        throw new Error(message);
    }
}

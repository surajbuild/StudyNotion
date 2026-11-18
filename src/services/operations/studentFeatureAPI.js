import toast from "react-hot-toast";
import { studentEndpoints } from "../apis";
import { apiConnector } from "../apiconnector";
import rzpLogo from "../../assets/Logo/rzp_logo.png"
import { setPaymentLoading } from "../../slices/courseSlice";
import { removeFromCart, resetCart } from "../../slices/cartSlice";
import { setUser } from "../../slices/profileSlice";


const {
    COURSE_PAYMENT_API,
    COURSE_VERIFY_API,
    ENROLL_FREE_COURSE_API,
    SEND_PAYMENT_SUCCESS_EMAIL_API,
} = studentEndpoints;

function loadScript(src) {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;

        script.onload = () => {
            resolve(true);
        }
        script.onerror = () => {
            resolve(false);
        }

        document.body.appendChild(script);
    })
}


export async function buyCourse(token, courses, userDetails, navigate, dispatch) {
    const toastId = toast.loading("Loading...");
    try{
        //load the script
        const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js")

        if(!res){
            toast.error("RazorPay SDK failed to load")
            return;
        }

        //initiate the order
        const orderResponse = await apiConnector("POST", COURSE_PAYMENT_API, 
                                {courses},
                                {
                                    Authorization: `Bearer ${token}`,
                                }
                            )
        if(!orderResponse.data.success){
            throw new Error(orderResponse.data.message);
        } 

        //options
        const orderData = orderResponse.data.message || orderResponse.data;
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
                email: userDetails.email
            },
            handler: function(response) {
                //send successful mail
                sendPaymentSuccessEmail(response, orderResponse.data.message.amount, token);

                //verify Payment
                verifyPayment({...response, courses}, token, navigate, dispatch);
            }
        }
         
        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
        paymentObject.on("payment.failed", function(response) {
            toast.error("oops, payment failed");
            console.log(response.error);
        })
    }
    catch(error) {
        console.log("PAYMENT API ERROR...", error)
        toast.error("Could not make Payment", { id: toastId });
    } finally {
        toast.dismiss(toastId);
    }
}

async function sendPaymentSuccessEmail(response, amount, token) {
    try{
        await apiConnector("POST", SEND_PAYMENT_SUCCESS_EMAIL_API, {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            amount,
        }, {
            Authorization: `Bearer ${token}`
        })
    }
    catch(error) {
        console.log("PAYMENT SUCCESS EMAIL ERROR...", error);
    }
}

//verify payment
async function verifyPayment(bodyData, token, navigate, dispatch) {
    const toastId = toast.loading("Verifying Payment...");
    dispatch(setPaymentLoading(true));
    try{
        const response = await apiConnector("POST", COURSE_VERIFY_API, bodyData, {
            Authorization: `Bearer ${token}`,
        })

        if(!response.data.success) {
            throw new Error(response.data.message);
        }
        toast.success("Payment successful, You are added to the course")
        navigate("/dashboard/enrolled-courses");
        dispatch(resetCart())
    }
    catch(error) {
        console.log("PAYMENT VERIFY ERROR...", error);
        toast.error("Could not verify Payment")
    }
    toast.dismiss(toastId);
    dispatch(setPaymentLoading(false))
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

        // Remove any enrolled free courses from cart
        courseList.forEach((courseId) => dispatch(removeFromCart(courseId)));

        // Sync enrolled course IDs into Redux user & localStorage
        if (userDetails) {
            const existingCourses = Array.isArray(userDetails.courses) ? userDetails.courses : [];
            const mergedCourses = [...new Set([...existingCourses.map(String), ...courseList.map(String)])];
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
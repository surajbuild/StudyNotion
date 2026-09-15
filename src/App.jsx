import { lazy, Suspense } from "react";
import "./App.css";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/common/Navbar";
import OpenRoute from "./components/core/Auth/OpenRoute";
import PrivateRoute from "./components/core/Auth/PrivateRoute";
import { ACCOUNT_TYPE } from "./utils/constants";
import { useSelector } from "react-redux";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Signup = lazy(() => import("./pages/Signup"));
const Catalog = lazy(() => import("./pages/Catalog"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Error = lazy(() => import("./pages/Error"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const MyProfile = lazy(() => import("./components/core/Dashboard/MyProfile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./components/core/Dashboard/Settings"));
const EnrolledCourses = lazy(() => import("./components/core/Dashboard/EnrolledCourses"));
const Cart = lazy(() => import("./components/core/Dashboard/Cart"));
const MyCourses = lazy(() => import("./components/core/Dashboard/MyCourses"));
const AddCourse = lazy(() => import("./components/core/Dashboard/AddCourse"));
const EditCourse = lazy(() => import("./components/core/Dashboard/EditCourse"));
const Instructor = lazy(() => import("./components/core/Dashboard/InstructorDashboard/Instructor"));
const CourseDetails = lazy(() => import("./pages/CourseDetails"));
const ViewCourse = lazy(() => import("./pages/ViewCourse"));
const VideoDetails = lazy(() => import("./components/core/ViewCourse/VideoDetails"));

// Shared loading fallback while a lazily-loaded route chunk arrives.
function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-richblack-300 border-t-yellow-50" />
    </div>
  );
}

function App() {
  const { user } = useSelector((state) => state.profile);
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden flex-col bg-richblack-900 font-inter">
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public routes ──────────────────────────────────────────────── */}
          <Route path="/" element={<Home />} />
          <Route path="/catalog/:categoryName" element={<Catalog />} />
          <Route path="/courses/:courseId" element={<CourseDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/update-password/:id" element={<UpdatePassword />} />

          <Route path="/signup" element={<OpenRoute><Signup /></OpenRoute>} />
          <Route path="/login" element={<OpenRoute><Login /></OpenRoute>} />
          <Route path="/forgot-password" element={<OpenRoute><ForgotPassword /></OpenRoute>} />
          <Route path="/verify-email" element={<OpenRoute><VerifyEmail /></OpenRoute>} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          >
            {/* Shared routes — available to ALL authenticated users */}
            <Route path="my-profile" element={<MyProfile />} />
            <Route path="settings" element={<Settings />} />

            {/* Student routes */}
            <Route path="cart" element={<Cart />} />
            <Route path="enrolled-courses" element={<EnrolledCourses />} />

            {/* Instructor routes */}
            <Route path="my-courses" element={<MyCourses />} />
            <Route path="add-course" element={<AddCourse />} />
            <Route path="edit-course/:courseId" element={<EditCourse />} />

            <Route path="instructor" element={<Instructor />} />
          </Route>

          <Route element={
            <PrivateRoute>
              <ViewCourse />
            </PrivateRoute>
          }>

            {
              user?.accountType === ACCOUNT_TYPE.STUDENT && (
                <>
                  <Route
                    path="view-course/:courseId/section/:sectionId/sub-section/:subSectionId"
                    element={<VideoDetails />} 
                  />
                </>
              )
            }

          </Route>

          {/* Catch-all — any URL that doesn't match shows the 404 page */}
          <Route path="*" element={<Error />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
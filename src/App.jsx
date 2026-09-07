import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Navbar from "./components/common/Navbar";
import ForgotPassword from "./pages/ForgotPassword";
import Signup from "./pages/Signup";
import OpenRoute from "./components/core/Auth/OpenRoute";
import Catalog from "./pages/Catalog";
import UpdatePassword from "./pages/UpdatePassword";
import VerifyEmail from "./pages/VerifyEmail";
import Error from "./pages/Error";
import About from "./pages/About";
import Contact from "./pages/Contact";
import MyProfile from "./components/core/Dashboard/MyProfile";
import Dashboard from "./pages/Dashboard";
import PrivateRoute from "./components/core/Auth/PrivateRoute";
import Settings from "./components/core/Dashboard/Settings";
import EnrolledCourses from "./components/core/Dashboard/EnrolledCourses";
import Cart from "./components/core/Dashboard/Cart";
import MyCourses from "./components/core/Dashboard/MyCourses";
import AddCourse from "./components/core/Dashboard/AddCourse";
import EditCourse from "./components/core/Dashboard/EditCourse";
import Instructor from "./components/core/Dashboard/InstructorDashboard/Instructor";
import CourseDetails from "./pages/CourseDetails";
import ViewCourse from "./pages/ViewCourse";
import { ACCOUNT_TYPE } from "./utils/constants";
import { useSelector } from "react-redux";
import VideoDetails from "./components/core/ViewCourse/VideoDetails";


function App() {
  const {user}  = useSelector((state) => state.profile);
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden flex-col bg-richblack-900 font-inter">
      <Navbar />
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
    </div>
  );
}

export default App;

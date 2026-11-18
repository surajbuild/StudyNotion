import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CiFacebook } from "react-icons/ci";
import { RiGoogleLine } from "react-icons/ri";
import { FaTwitter, FaYoutube } from "react-icons/fa";
import logo from "../../assets/Logo/Logo-Small-Light.png";
import { FooterLink2 } from "../../data/footer-links";
import { apiConnector } from "../../services/apiconnector";
import { categories as categoryEndpoints } from "../../services/apis";

const socialLinks = [
  {
    icon: <CiFacebook />,
    link: "https://www.facebook.com",
    label: "Facebook",
  },
  {
    icon: <RiGoogleLine />,
    link: "https://www.google.com",
    label: "Google",
  },
  {
    icon: <FaTwitter />,
    link: "https://x.com/suraj2020kmr",
    label: "Twitter",
  },
  {
    icon: <FaYoutube />,
    link: "https://www.youtube.com/channel/UCbpYaGifL2ZPRFBti_q_t1A",
    label: "YouTube",
  },
];

const leftSectionData = [
  {
    title: "Company",
    links: [
      { title: "About", link: "/about" },
      { title: "Contact Us", link: "/contact" },
    ],
  },
  {
    title: "Learning",
    links: [
      { title: "Home", link: "/" },
      { title: "For Students", link: "/signup" },
      { title: "For Instructors", link: "/signup" },
    ],
  },
  {
    title: "Support",
    links: [{ title: "Help Center", link: "/contact" }],
  },
];

const slugifyCategory = (name) =>
  name?.toString().trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "";

const Footer = () => {
  const [catalogCategories, setCatalogCategories] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const res = await apiConnector("GET", categoryEndpoints.CATEGORIES_API);
        if (isMounted && Array.isArray(res?.data?.data)) {
          setCatalogCategories(res.data.data.filter((cat) => cat?.name?.trim()));
        }
      } catch {
        // Silently degrade when API is unreachable — static valid links remain available
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="bg-richblack-800 text-richblack-400">
      <div className="w-11/12 max-w-maxContent mx-auto px-4 py-12 md:px-6 md:py-14">
        {/* ─── TOP SECTION ─── */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12">
          {/* LEFT SECTION — logo, verified internal links, external social links */}
          <div className="lg:w-1/2">
            <div className="mb-8">
              <Link to="/" className="inline-flex items-center gap-2 text-richblack-50 mb-6 group">
                <img
                  src={logo}
                  alt="StudyNotion Logo"
                  className="h-6 group-hover:scale-105 transition-transform duration-200"
                />
                <h3 className="text-xl font-semibold group-hover:text-yellow-50 transition-colors duration-200">
                  StudyNotion
                </h3>
              </Link>

              <div className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {leftSectionData.map((section, index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-richblack-100 font-semibold text-sm md:text-base">
                        {section.title}
                      </p>
                      <ul className="space-y-1">
                        {section.links.map((link, linkIndex) => (
                          <li key={linkIndex}>
                            <Link
                              to={link.link}
                              className="text-richblack-400 hover:text-richblack-50 transition-colors duration-200 text-xs md:text-sm"
                            >
                              {link.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social media icons (external destinations) */}
              <div>
                <p className="text-richblack-100 font-semibold mb-3">
                  Connect with us
                </p>
                <div className="flex gap-4 text-xl md:text-2xl">
                  {socialLinks.map((item, index) => (
                    <a
                      key={index}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-yellow-50 transition-all duration-200 hover:scale-110"
                      aria-label={`Follow us on ${item.label}`}
                    >
                      {item.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Vertical divider — visible only on large screens */}
          <div className="hidden lg:block w-px bg-richblack-700"></div>

          {/* RIGHT SECTION — Live Catalog Categories + Verified Navigation */}
          <div className="lg:w-1/2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogCategories.length > 0 && (
                <div className="space-y-3">
                  <p className="text-richblack-100 font-semibold text-sm md:text-base">
                    Catalog
                  </p>
                  <ul className="space-y-1">
                    {catalogCategories.map((cat) => (
                      <li key={cat._id || cat.name}>
                        <Link
                          to={`/catalog/${slugifyCategory(cat.name)}`}
                          className="text-richblack-400 hover:text-richblack-50 transition-colors duration-200 text-xs md:text-sm"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {FooterLink2.map((section, index) => (
                <div key={index} className="space-y-3">
                  <p className="text-richblack-100 font-semibold text-sm md:text-base">
                    {section.title}
                  </p>
                  <ul className="space-y-1">
                    {section.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <Link
                          to={link.link}
                          className="text-richblack-400 hover:text-richblack-50 transition-colors duration-200 text-xs md:text-sm"
                        >
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── BOTTOM SECTION — copyright + verified support link ─── */}
        <div className="border-t border-richblack-700 mt-10 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-richblack-300 text-sm text-center md:text-left">
              © {new Date().getFullYear()} StudyNotion. All rights reserved.
            </p>

            <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm">
              <Link
                to="/about"
                className="text-richblack-400 hover:text-richblack-50 transition-colors duration-200"
              >
                About StudyNotion
              </Link>
              <Link
                to="/contact"
                className="text-richblack-400 hover:text-richblack-50 transition-colors duration-200"
              >
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

const React = require("react");

module.exports = {
  Navigate: ({ to }) => React.createElement("div", { "data-testid": "redirect-to" }, to),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/" }),
  useParams: () => ({}),
  Link: ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children),
  NavLink: ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children),
};

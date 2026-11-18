const React = require("react");

module.exports = {
  Navigate: ({ to }) => React.createElement("div", { "data-testid": "redirect-to" }, to),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/", search: "" }),
  useParams: () => ({}),
  useSearchParams: () => {
    const [params, setParams] = React.useState(() => new URLSearchParams());
    const updateParams = React.useCallback((next) => {
      setParams((prev) => {
        if (typeof next === "function") return new URLSearchParams(next(prev));
        return new URLSearchParams(next);
      });
    }, []);
    return [params, updateParams];
  },
  Link: ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children),
  NavLink: ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children),
};

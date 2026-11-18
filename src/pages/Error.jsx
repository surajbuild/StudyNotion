import { Link } from "react-router-dom";

const StrangerThings = ({ className }) => {
  return (
    <div
      className={`error-page-container min-h-[calc(100vh-3.5rem)] w-full flex flex-col items-center justify-center p-6 overflow-hidden bg-black ${className || ""}`}
      style={{ perspective: "1200px" }}
    >
      <style>
        {`
        .error-page-container {
          background: #000000;
        }
        
        @keyframes slideDown {
          0% { transform: translateY(-30%); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @keyframes slideUp {
          0% { transform: translateY(30%); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @keyframes slideRight {
          0% { transform: translateX(-60%); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @keyframes slideLeft {
          0% { transform: translateX(60%); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes slideUpFadeIn {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @keyframes scaleXIn {
          0% { transform: scaleX(0); }
          100% { transform: none; }
        }
        @keyframes zoomFadeIn {
          0% { opacity: 0; transform: translateZ(800px) scale(1.2); }
          100% { opacity: 1; transform: translateZ(0) scale(1); }
        }
        @keyframes jitter {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(2px, -1px); }
          50% { transform: translate(-1px, 2px); }
          75% { transform: translate(1px, 1px); }
        }
        
        @keyframes horribleBlink {
          0%, 100% { 
            opacity: 1; 
            text-shadow: 
              0 0 10px #8b0000,
              0 0 20px #8b0000,
              0 0 30px #ff0000,
              0 0 40px #ff0000,
              0 0 70px #ff0000;
          }
          50% { 
            opacity: 0.3; 
            text-shadow: 
              0 0 5px #8b0000,
              0 0 10px #ff0000;
          }
        }
        
        @keyframes textGlitch {
          0% {
            text-shadow: 
              2px 2px 0 #8b0000,
              -2px -2px 0 #ff0000;
            transform: translate(0, 0);
          }
          50% {
            text-shadow: 
              -2px 2px 0 #8b0000,
              2px -2px 0 #ff0000;
            transform: translate(1px, -1px);
          }
          100% {
            text-shadow: 
              2px 2px 0 #8b0000,
              -2px -2px 0 #ff0000;
            transform: translate(0, 0);
          }
        }

        .main-svg-container {
          animation: zoomFadeIn 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
          filter: drop-shadow(0 0 20px rgba(139, 0, 0, 0.7));
        }

        .error-1-e { animation: slideRight 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .error-2-r { animation: slideDown 4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .error-4-o { animation: slideLeft 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .error-5-r { animation: slideLeft 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .error-2-0 { animation: slideUp 4.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .error-top, .error-left, .error-right {
          animation: scaleXIn 4s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
          transform: scaleX(0);
        }
        .error-top { transform-origin: center; }
        .error-left { transform-origin: left; }
        .error-right { transform-origin: right; }

        .quote-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #8b0000;
          text-transform: uppercase;
          text-align: center;
          letter-spacing: 0.4em;
          font-family: "Impact", "Arial Black", sans-serif;
          opacity: 0;
          animation: slideUpFadeIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) 2.5s forwards;
        }

        .quote-top { 
          font-size: 0.85rem; 
          font-weight: 900;
          animation: horribleBlink 1.2s infinite, textGlitch 0.25s infinite;
          color: #8b0000;
          -webkit-text-stroke: 1px #ff0000;
          filter: drop-shadow(0 0 5px #8b0000);
          letter-spacing: 0.5em;
        }
        
        .quote-bottom { 
          font-size: 1.25rem; 
          font-weight: 900;
          opacity: 0;
          animation: 
            slideUpFadeIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) 3s forwards,
            horribleBlink 1.8s infinite 3s,
            textGlitch 0.35s infinite 3s;
          color: #8b0000;
          -webkit-text-stroke: 2px #ff0000;
          filter: drop-shadow(0 0 8px #8b0000);
          letter-spacing: 0.6em;
        }

        @media (min-width: 640px) {
          .quote-top { 
            font-size: 1rem; 
          }
          .quote-bottom { 
            font-size: 1.75rem; 
          }
        }

        .cta {
          margin-top: 32px;
          padding: 12px 32px;
          border: 2px solid #8b0000;
          color: #8b0000;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 0.9rem;
          font-weight: 900;
          background: rgba(0, 0, 0, 0.9);
          border-radius: 4px;
          transition: all 0.3s ease;
          opacity: 0;
          animation: fadeIn 1s ease 4s forwards;
          cursor: pointer;
          font-family: "Impact", sans-serif;
          text-shadow: 0 0 5px #8b0000;
          box-shadow: 
            0 0 20px rgba(139, 0, 0, 0.7),
            inset 0 0 10px rgba(139, 0, 0, 0.3);
        }

        .cta:hover {
          background: rgba(20, 0, 0, 0.9);
          border-color: #ff0000;
          color: #ff0000;
          box-shadow: 
            0 0 30px rgba(139, 0, 0, 0.9),
            inset 0 0 15px rgba(139, 0, 0, 0.5);
          transform: translateY(-2px);
        }

        .jitter-link:hover {
          animation: jitter 0.3s infinite;
        }
        
        .top {
          stroke: #8b0000 !important;
          stroke-width: 2px !important;
          filter: drop-shadow(0 0 10px #8b0000) !important;
        }
        
        .glow {
          filter: drop-shadow(0 0 15px rgba(139, 0, 0, 0.7)) !important;
        }
      `}
      </style>

      <main className="w-full h-full flex flex-col items-center justify-center space-y-8">
        <div
          className="main-svg-container opacity-0 w-full flex justify-center"
          style={{ transform: "translateZ(250px)" }}
        >
          <svg
            className="w-[90%] sm:w-[500px] md:w-[636px] h-auto"
            viewBox="-110 0 556 190"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
                filterUnits="objectBoundingBox"
                id="stroke-glow"
              >
                <feMorphology
                  radius="1"
                  operator="dilate"
                  in="SourceAlpha"
                  result="shadowSpreadOuter1"
                />
                <feOffset
                  dx="0"
                  dy="0"
                  in="shadowSpreadOuter1"
                  result="shadowOffsetOuter1"
                />
                <feMorphology
                  radius="1"
                  operator="erode"
                  in="SourceAlpha"
                  result="shadowInner"
                />
                <feOffset dx="0" dy="0" in="shadowInner" result="shadowInner" />
                <feComposite
                  in="shadowOffsetOuter1"
                  in2="shadowInner"
                  operator="out"
                  result="shadowOffsetOuter1"
                />
                <feGaussianBlur
                  stdDeviation="4"
                  in="shadowOffsetOuter1"
                  result="shadowBlurOuter1"
                />
                <feColorMatrix
                  values="0 0 0 0 0.545 0 0 0 0 0 0 0 0 0 0 0 0 0 0.8 0"
                  type="matrix"
                  in="shadowBlurOuter1"
                />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <path
                d="M213.248,144.368 L193.952,144.368 C196.544,138.992 201.248,133.712 205.472,126.8 C211.136,117.584 213.92,109.904 213.92,103.856 C213.92,102.8 213.824,101.552 213.632,100.112 L200.48,110.096 C200.96,110.48 201.344,110.864 201.536,111.344 C201.824,111.92 201.92,112.592 201.92,113.264 C201.92,117.872 199.136,123.728 194.528,131.312 C189.92,139.088 185.792,144.944 185.792,151.472 L185.792,152.144 C186.464,150.992 187.712,150.608 189.632,150.608 L213.248,150.608 L213.248,158.096 C213.248,162.704 212.096,164.816 208.064,165.776 L208.064,167.696 L233.312,167.696 L233.312,165.776 C229.28,164.816 228.128,162.704 228.128,158.096 L228.128,150.608 L232.352,150.608 C234.08,150.608 234.944,151.376 235.424,153.008 L238.016,140.528 C236,143.12 234.08,144.368 231.584,144.368 L228.128,144.368 L228.128,115.184 C228.128,110.96 228.704,105.392 229.856,98.384 L227.84,98 C225.92,109.04 220.832,115.856 213.248,118.064 L213.248,144.368 Z"
                id="error-3-4"
              ></path>
              <path
                d="M159.816,103.088 C173.544,103.088 183.816,115.664 183.816,135.92 C183.816,156.176 173.544,168.848 159.816,168.848 C146.088,168.848 135.816,156.272 135.816,135.92 C135.816,115.568 146.088,103.088 159.816,103.088 Z M159.816,109.04 C154.056,109.04 152.04,117.776 152.04,135.92 C152.04,154.064 154.056,162.8 159.816,162.8 C165.576,162.8 167.592,154.064 167.592,135.92 C167.592,117.776 165.576,109.04 159.816,109.04 Z"
                id="error-2-0"
              ></path>
              <path
                d="M107.456,144.368 L88.16,144.368 C90.752,138.992 95.456,133.712 99.68,126.8 C105.344,117.584 108.128,109.904 108.128,103.856 C108.128,102.8 108.032,101.552 107.84,100.112 L94.688,110.096 C95.168,110.48 95.552,110.864 95.744,111.344 C96.032,111.92 96.128,112.592 96.128,113.264 C96.128,117.872 93.344,123.728 88.736,131.312 C84.128,139.088 80,144.944 80,151.472 L80,152.144 C80.672,150.992 81.92,150.608 83.84,150.608 L107.456,150.608 L107.456,158.096 C107.456,162.704 106.304,164.816 102.272,165.776 L102.272,167.696 L127.52,167.696 L127.52,165.776 C123.488,164.816 122.336,162.704 122.336,158.096 L122.336,150.608 L126.56,150.608 C128.288,150.608 129.152,151.376 129.632,153.008 L132.224,140.528 C130.208,143.12 128.288,144.368 125.792,144.368 L122.336,144.368 L122.336,115.184 C122.336,110.96 122.912,105.392 124.064,98.384 L122.048,98 C120.128,109.04 115.04,115.856 107.456,118.064 L107.456,144.368 Z"
                id="error-1-4"
              ></path>
              <path
                d="M37.4817931,46.5 L37.4817931,39.6206897 C37.4817931,33.5862069 37.9645517,30.8103448 44.9645517,30.8103448 C55.705931,30.8103448 63.5507586,37.3275862 66.6886897,48.9137931 L68.2576552,48.6724138 L64.2748966,22 C62.8266207,23.5689655 60.7748966,24.0517241 57.7576552,24.0517241 L10.568,24.0517241 L10.568,27.4310345 C14.3093793,27.6724138 16.2404138,30.2068966 16.2404138,34.9137931 L16.2404138,92.9655172 C16.2404138,97.6724138 14.3093793,100.327586 10.568,100.568966 L10.568,103.948276 L55.3438621,103.948276 C60.6542069,103.948276 63.9128276,104.068966 65.4817931,106 L73.568,76.0689655 L72.3611034,75.7068966 C65.6024828,90.0689655 56.6714483,97.3103448 45.8093793,97.3103448 C37.6024828,97.3103448 37.4817931,93.5689655 37.4817931,85.6034483 L37.4817931,53.5 L40.6197241,53.5 C49.1886897,53.5 53.6542069,57.1206897 55.3438621,65.8103448 L56.7921379,65.8103448 L54.0162759,37.6896552 L52.568,37.6896552 C51.9645517,43.9655172 49.068,46.5 42.6714483,46.5 L37.4817931,46.5 Z"
                id="error-1-e"
              ></path>
              <path
                d="M77.384,24 L114.248,24 C124.232,24 129.224,27.072 129.224,33.792 C129.224,40.032 125.384,44.64 117.512,48.672 C124.616,58.176 127.976,69.12 131.912,80.256 C132.488,81.792 133.064,82.848 133.448,83.424 C134.216,84.384 135.176,84.768 136.52,84.864 L136.52,87.552 L111.848,87.552 L111.848,84.864 C113.672,84.768 114.536,83.712 114.536,81.696 C114.536,78.528 111.848,68.352 103.688,54.816 C102.152,55.488 100.616,55.872 98.792,56.256 L98.792,78.816 C98.792,82.656 100.232,84.672 103.208,84.864 L103.208,87.552 L77.384,87.552 L77.384,84.864 C80.36,84.672 81.896,82.56 81.896,78.816 L81.896,32.64 C81.896,28.896 80.36,26.88 77.384,26.688 L77.384,24 Z M98.792,49.92 C107.432,47.616 112.136,42.624 112.136,36.576 C112.136,32.256 109.64,29.856 105.128,29.856 C100.424,29.856 98.792,31.584 98.792,36 L98.792,49.92 Z"
                id="error-2-r"
              ></path>
              <path
                d="M140.072,24 L176.936,24 C186.92,24 191.912,27.072 191.912,33.792 C191.912,40.032 188.072,44.64 180.2,48.672 C187.304,58.176 190.664,69.12 194.6,80.256 C195.176,81.792 195.752,82.848 196.136,83.424 C196.904,84.384 197.864,84.768 199.208,84.864 L199.208,87.552 L174.536,87.552 L174.536,84.864 C176.36,84.768 177.224,83.712 177.224,81.696 C177.224,78.528 174.536,68.352 166.376,54.816 C164.84,55.488 163.304,55.872 161.48,56.256 L161.48,78.816 C161.48,82.656 162.92,84.672 165.896,84.864 L165.896,87.552 L140.072,87.552 L140.072,84.864 C143.048,84.672 144.584,82.56 144.584,78.816 L144.584,32.64 C144.584,28.896 143.048,26.88 140.072,26.688 L140.072,24 Z M161.48,49.92 C170.12,47.616 174.824,42.624 174.824,36.576 C174.824,32.256 172.328,29.856 167.816,29.856 C163.112,29.856 161.48,31.584 161.48,36 L161.48,49.92 Z"
                id="error-3-r"
              ></path>
              <path
                d="M192.744,56.6360024 C192.744,36.1880024 205.416,22.9400024 223.08,22.9400024 C240.456,22.9400024 251.976,35.1320024 251.976,55.7720024 C251.976,65.1800024 248.808,73.5320024 243.336,79.4840024 C237.96,85.3400024 230.28,88.7000024 222.408,88.7000024 C204.264,88.7000024 192.744,76.4120024 192.744,56.6360024 Z M221.544,28.8920024 C213.96,28.8920024 210.408,35.7080024 210.408,49.4360024 C210.408,71.5160024 214.44,82.4600024 222.984,82.4600024 C230.568,82.4600024 234.12,75.6440024 234.12,61.7240024 C234.12,39.7400024 230.088,28.8920024 221.544,28.8920024 Z"
                id="error-4-o"
              ></path>
              <path
                d="M252,24 L298.12987,24 C310.623377,24 316.87013,27.8187311 316.87013,36.1722054 C316.87013,43.929003 312.064935,49.6570997 302.214286,54.6691843 C311.103896,66.4833837 315.308442,80.0876133 320.233766,93.9305136 C320.954545,95.8398792 321.675325,97.152568 322.155844,97.8685801 C323.116883,99.0619335 324.318182,99.5392749 326,99.6586103 L326,103 L295.126623,103 L295.126623,99.6586103 C297.409091,99.5392749 298.49026,98.2265861 298.49026,95.7205438 C298.49026,91.7824773 295.126623,79.1329305 284.915584,62.3066465 C282.993506,63.141994 281.071429,63.6193353 278.788961,64.0966767 L278.788961,92.1404834 C278.788961,96.9138973 280.590909,99.4199396 284.314935,99.6586103 L284.314935,103 L252,103 L252,99.6586103 C255.724026,99.4199396 257.646104,96.7945619 257.646104,92.1404834 L257.646104,34.7401813 C257.646104,30.0861027 255.724026,27.5800604 252,27.3413897 L252,24 Z M278.788961,56.2205438 C289.600649,53.3564955 295.487013,47.1510574 295.487013,39.6329305 C295.487013,34.2628399 292.363636,31.2794562 286.717532,31.2794562 C280.831169,31.2794562 278.788961,33.4274924 278.788961,38.9169184 L278.788961,56.2205438 Z"
                id="error-5-r"
              ></path>

              <rect
                id="error-right"
                x="252"
                y="113"
                width="74"
                height="4"
              ></rect>
              <rect id="error-left" x="10" y="113" width="63" height="4"></rect>
              <rect id="error-top" x="10" y="10" width="307" height="4"></rect>
            </defs>
            <g fillRule="evenodd">
              <g className="glow fill-black">
                <use
                  className="error-3-4"
                  filter="url(#stroke-glow)"
                  href="#error-3-4"
                />
                <use
                  className="error-2-0"
                  filter="url(#stroke-glow)"
                  href="#error-2-0"
                />
                <use
                  className="error-1-4"
                  filter="url(#stroke-glow)"
                  href="#error-1-4"
                />
                <use
                  className="error-1-e"
                  filter="url(#stroke-glow)"
                  href="#error-1-e"
                />
                <use
                  className="error-2-r"
                  filter="url(#stroke-glow)"
                  href="#error-2-r"
                />
                <use
                  className="error-3-r"
                  filter="url(#stroke-glow)"
                  href="#error-3-r"
                />
                <use
                  className="error-4-o"
                  filter="url(#stroke-glow)"
                  href="#error-4-o"
                />
                <use
                  className="error-5-r"
                  filter="url(#stroke-glow)"
                  href="#error-5-r"
                />
                <use
                  className="error-right"
                  filter="url(#stroke-glow)"
                  href="#error-right"
                />
                <use
                  className="error-left"
                  filter="url(#stroke-glow)"
                  href="#error-left"
                />
                <use
                  className="error-top"
                  filter="url(#stroke-glow)"
                  href="#error-top"
                />
              </g>
              <g className="top fill-none stroke-[#8b0000] stroke-[2px] stroke-round stroke-linejoin-round">
                <use className="error-3-4" href="#error-3-4" />
                <use className="error-2-0" href="#error-2-0" />
                <use className="error-1-4" href="#error-1-4" />
                <use className="error-1-e" href="#error-1-e" />
                <use className="error-2-r" href="#error-2-r" />
                <use className="error-3-r" href="#error-3-r" />
                <use className="error-4-o" href="#error-4-o" />
                <use className="error-5-r" href="#error-5-r" />
                <use className="error-right" href="#error-right" />
                <use className="error-left" href="#error-left" />
                <use className="error-top" href="#error-top" />
              </g>
            </g>
          </svg>
        </div>

        <div className="w-full flex justify-center text-center">
          <div className="quote-wrapper">
            <span className="quote-top">Lost in the </span>
            <span className="quote-bottom">Upside Down..?</span>
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            to="/"
            className="cta jitter-link"
            aria-label="Go to right side up"
          >
            Go to right side up
          </Link>
        </div>
      </main>
    </div>
  );
};

export default StrangerThings;
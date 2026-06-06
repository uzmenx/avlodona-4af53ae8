import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish: () => void;
  minDuration?: number;
}

export const SplashScreen = ({ onFinish, minDuration = 1800 }: SplashScreenProps) => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setVisible(false);
        onFinish();
      }, 400); // fade-out animation duration
    }, minDuration);

    return () => clearTimeout(timer);
  }, [onFinish, minDuration]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.4s ease-out",
        overflow: "hidden",
      }}
    >
      {/* Top-right decorative arc */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: "50%",
          backgroundColor: "#FFB300",
          opacity: 0.95,
        }}
      />

      {/* Bottom-left decorative arc */}
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 260,
          height: 260,
          borderRadius: "50%",
          backgroundColor: "#FFB300",
          opacity: 0.95,
        }}
      />

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <img
          src="/app-logo.png"
          alt="Avlodona Logo"
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            borderRadius: 24,
            marginBottom: 20,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        />

        {/* App name */}
        <h1
          style={{
            fontFamily: "'Work Sans', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: "#1a1a1a",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          Avlodona
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "'Work Sans', sans-serif",
            fontSize: 14,
            fontWeight: 400,
            color: "#888888",
            margin: "6px 0 0 0",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
          }}
        >
          Oila tarmog'i
        </p>

        {/* Loading dots */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 40,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#FFB300",
                animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

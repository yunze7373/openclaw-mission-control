"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check cookie
    if (document.cookie.includes("mc_logged_in=true")) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Set password - change "han123" to your desired password
    if (password === "han123") {
      // Set cookie for 7 days
      const d = new Date();
      d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
      document.cookie = "mc_logged_in=true;expires=" + d.toUTCString() + ";path=/";
      router.push("/");
    } else {
      alert("Wrong password!");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <form onSubmit={handleLogin} style={{ padding: "2rem", background: "#111", borderRadius: "12px", width: "300px" }}>
        <h1 style={{ color: "#fff", marginBottom: "1.5rem", fontSize: "1.5rem" }}>Mission Control</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", background: "#222", border: "1px solid #333", borderRadius: "6px", color: "#fff" }}
        />
        <button type="submit" style={{ width: "100%", padding: "0.75rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          Login
        </button>
      </form>
    </div>
  );
}

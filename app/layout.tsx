export const metadata = {
  title: "Agri Prices MCP · MCP Africa Master Class",
  description: "A teaching MCP server for the MCP Africa Symposium 2026 Master Class.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "48px auto", padding: "0 20px", lineHeight: 1.6 }}>
        {children}
      </body>
    </html>
  );
}

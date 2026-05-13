import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";
import AddBootstrap from "./components/BootstrapClient";
import AuthGate from "./components/AuthGate";
import GlobalSendProgress from "./components/GlobalSendProgress";
import { ToastProvider } from "./components/Toast";

export const metadata = {
  title: "MailDeck — Email Operations Console",
  description: "Send, track, and manage bulk emails with campaigns, analytics, and audience tools.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AddBootstrap />
        <ToastProvider>
          <AuthGate>{children}</AuthGate>
          <GlobalSendProgress />
        </ToastProvider>
      </body>
    </html>
  );
}

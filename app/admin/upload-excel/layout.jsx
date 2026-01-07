import ClientAuthWrapper from "@/app/components/ClientAuthWrapper";


export default function AdminLayout({ children }) {
  return (
    <ClientAuthWrapper>
      {children}
    </ClientAuthWrapper>
  );
}

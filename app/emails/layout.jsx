import ClientAuthWrapper from "../components/ClientAuthWrapper";


export default function EmailLayout({ children }) {
    return (
        <>
            <ClientAuthWrapper>{children}</ClientAuthWrapper>
        </>
    );
}

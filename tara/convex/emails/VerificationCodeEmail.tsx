import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function VerificationCodeEmail({
  code,
  expiresMinutes,
  heading = "Your TARA verification code",
}: {
  code: string;
  expiresMinutes: number;
  heading?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{code} is your TARA verification code</Preview>
      <Body style={{ backgroundColor: "#f4f5f3", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "40px auto",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "420px",
            border: "1px solid #e5e7eb",
          }}
        >
          <Heading style={{ fontSize: "20px", color: "#111827", margin: "0 0 16px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#4b5563", lineHeight: "22px" }}>
            Enter this code to continue. It expires in {expiresMinutes} minutes.
          </Text>
          <Section
            style={{
              backgroundColor: "#f4f5f3",
              borderRadius: "6px",
              padding: "16px",
              textAlign: "center",
              margin: "20px 0",
            }}
          >
            <Text
              style={{
                fontSize: "32px",
                fontWeight: 600,
                letterSpacing: "8px",
                color: "#0f4d3a",
                margin: 0,
                fontFamily: "monospace",
              }}
            >
              {code}
            </Text>
          </Section>
          <Text style={{ fontSize: "12px", color: "#9ca3af", lineHeight: "18px" }}>
            If you didn&apos;t request this, you can ignore this email — no account changes will
            be made without the code above.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerificationCodeEmail;

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email'

const copy = {
  en: {
    preview: 'Confirm your email address to get started',
    heading: 'Welcome aboard',
    intro: (name: string) =>
      `Hi ${name}, thanks for signing up. Confirm your email address to activate your account.`,
    button: 'Confirm email address',
    expiry: 'This link expires in 24 hours.',
    footer: 'You received this email because you created an account.',
  },
  es: {
    preview: 'Confirma tu dirección de correo para empezar',
    heading: 'Te damos la bienvenida',
    intro: (name: string) =>
      `Hola ${name}, gracias por registrarte. Confirma tu dirección de correo para activar tu cuenta.`,
    button: 'Confirmar correo',
    expiry: 'Este enlace caduca en 24 horas.',
    footer: 'Recibes este correo porque creaste una cuenta.',
  },
} as const

type Props = {
  locale: keyof typeof copy
  data: {
    name: string
    confirmationUrl: string
    supportEmail: string
  }
}

export const WelcomeEmail = ({ locale, data }: Props) => {
  const t = copy[locale]

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={text}>{t.intro(data.name)}</Text>
          <Section style={buttonSection}>
            <Button style={button} href={data.confirmationUrl}>
              {t.button}
            </Button>
          </Section>
          <Text style={muted}>{t.expiry}</Text>
          <Hr style={hr} />
          <Text style={muted}>
            {t.footer}{' '}
            <Link href={`mailto:${data.supportEmail}`}>
              {data.supportEmail}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: 'Helvetica, Arial, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px',
  maxWidth: '600px',
}

const heading = {
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 16px',
}

const text = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#334155',
}

const buttonSection = {
  margin: '24px 0',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  padding: '12px 20px',
  textDecoration: 'none',
}

const muted = {
  fontSize: '13px',
  color: '#64748b',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
}

export default WelcomeEmail

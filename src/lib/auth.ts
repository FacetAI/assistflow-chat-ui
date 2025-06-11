import { type AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import crypto from "crypto"

// Check if we're in local development mode
const isLocalDev = process.env.LOCAL_DEV_MODE === "true";

const cognitoClient = new CognitoIdentityProviderClient({
  region: "eu-west-1",
})

function generateSecretHash(username: string): string {
  const message = username + process.env.COGNITO_CLIENT_ID!
  const hash = crypto.createHmac("sha256", process.env.COGNITO_CLIENT_SECRET!)
  hash.update(message)
  return hash.digest("base64")
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (process.env.LOCAL_DEV_MODE === 'true') {
          console.log('🔧 Local dev mode: bypassing Cognito authentication')
          return {
            id: process.env.LOCAL_DEV_USER_ID || 'local-dev-user',
            email: process.env.LOCAL_DEV_USER_EMAIL || 'dev@localhost',
            name: process.env.LOCAL_DEV_USER_NAME || 'Local Developer',
            accessToken: 'local-dev-token',
          }
        }

        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Local development mode - bypass Cognito
        if (isLocalDev) {
          console.log("🔧 Local development mode: bypassing Cognito authentication");
          
          // Accept any credentials for local development
          return {
            id: process.env.LOCAL_DEV_USER_ID || "local-dev-user",
            email: process.env.LOCAL_DEV_USER_EMAIL || credentials.email,
            name: process.env.LOCAL_DEV_USER_NAME || "Local Developer",
            accessToken: "local-dev-token",
          };
        }

        try {
          const authParameters: Record<string, string> = {
            USERNAME: credentials.email,
            PASSWORD: credentials.password,
          }

          if (process.env.COGNITO_CLIENT_SECRET) {
            authParameters.SECRET_HASH = generateSecretHash(credentials.email)
          }

          const authCommand = new InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthParameters: authParameters,
          })

          const authResponse = await cognitoClient.send(authCommand)

          if (!authResponse.AuthenticationResult?.AccessToken) {
            return null
          }

          const getUserCommand = new GetUserCommand({
            AccessToken: authResponse.AuthenticationResult.AccessToken,
          })

          const userResponse = await cognitoClient.send(getUserCommand)

          const userAttributes = userResponse.UserAttributes || []
          const sub = userAttributes.find((attr) => attr.Name === "sub")?.Value
          const email = userAttributes.find((attr) => attr.Name === "email")?.Value
          const name = userAttributes.find((attr) => attr.Name === "name")?.Value ||
            userAttributes.find((attr) => attr.Name === "given_name")?.Value ||
            userAttributes.find((attr) => attr.Name === "family_name")?.Value

          if (!sub) {
            throw new Error("Unable to retrieve user UUID from Cognito")
          }

          return {
            id: sub,
            email: email || credentials.email,
            name: name || email || credentials.email,
            accessToken: authResponse.AuthenticationResult.AccessToken,
          }
        } catch (error) {
          console.error("Cognito authentication error:", error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/auth/signin",
  },
  debug: process.env.NODE_ENV === "development",
  useSecureCookies: process.env.NODE_ENV === "production",
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.accessToken = user.accessToken
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.name = token.name
        session.accessToken = token.accessToken
      }
      return session
    },
    async redirect({ url, baseUrl }: any) {
      console.log("Redirect callback - url:", url, "baseUrl:", baseUrl);
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

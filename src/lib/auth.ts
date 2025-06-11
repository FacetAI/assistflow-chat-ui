import { type AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import crypto from "crypto"

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
  },
  secret: process.env.NEXTAUTH_SECRET,
}

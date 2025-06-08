import CredentialsProvider from "next-auth/providers/credentials";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";

const cognitoClient = new CognitoIdentityProviderClient({
  region: "eu-west-1",
});

// Generate secret hash required by Cognito
function generateSecretHash(username: string): string {
  const message = username + process.env.COGNITO_CLIENT_ID!;
  const hash = crypto.createHmac("sha256", process.env.COGNITO_CLIENT_SECRET!);
  hash.update(message);
  return hash.digest("base64");
}


export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Authenticate with Cognito
          const authParameters: any = {
            USERNAME: credentials.email,
            PASSWORD: credentials.password,
          };

          // Add SECRET_HASH if client secret is available
          if (process.env.COGNITO_CLIENT_SECRET) {
            authParameters.SECRET_HASH = generateSecretHash(credentials.email);
          }

          const authCommand = new InitiateAuthCommand({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthParameters: authParameters,
          });

          const authResponse = await cognitoClient.send(authCommand);

          if (!authResponse.AuthenticationResult?.AccessToken) {
            return null;
          }

          // Get user information
          const getUserCommand = new GetUserCommand({
            AccessToken: authResponse.AuthenticationResult.AccessToken,
          });

          const userResponse = await cognitoClient.send(getUserCommand);

          const userAttributes = userResponse.UserAttributes || [];
          const sub = userAttributes.find((attr) => attr.Name === "sub")?.Value;
          const email = userAttributes.find(
            (attr) => attr.Name === "email",
          )?.Value;
          const name =
            userAttributes.find((attr) => attr.Name === "name")?.Value ||
            userAttributes.find((attr) => attr.Name === "given_name")?.Value ||
            userAttributes.find((attr) => attr.Name === "family_name")?.Value;

          if (!sub) {
            throw new Error("Unable to retrieve user UUID from Cognito");
          }

          return {
            id: sub,
            email: email || credentials.email,
            name: name || email || credentials.email,
            accessToken: authResponse.AuthenticationResult.AccessToken,
          };
        } catch (error) {
          console.error("Cognito authentication error:", error);
          
          // Handle specific Cognito errors
          if (error instanceof Error) {
            if (error.name === "NotAuthorizedException") {
              console.error("Invalid credentials provided");
            } else if (error.name === "UserNotFoundException") {
              console.error("User not found");
            } else if (error.name === "UserNotConfirmedException") {
              console.error("User email not confirmed");
            } else if (error.name === "TooManyRequestsException") {
              console.error("Too many login attempts");
            }
          }
          
          return null;
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
    async jwt({ token, user }: any) {
      console.log("JWT callback - user:", user ? "present" : "absent", "token.email:", token.email);
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.accessToken = user.accessToken;
        console.log("JWT callback - updated token with user data");
      }
      return token;
    },
    async session({ session, token }: any) {
      console.log("Session callback - token.email:", token.email, "session.user.email:", session.user?.email);
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.accessToken = token.accessToken;
        console.log("Session callback - updated session with token data");
      }
      return session;
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
};

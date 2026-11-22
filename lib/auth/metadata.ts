import { generateProtectedResourceMetadata } from "mcp-handler";
import { SCOPES, issuer, resourceUrl } from "./config";

/** RFC 8414 authorization server metadata. Clients discover every endpoint from here. */
export function authorizationServerMetadata(req: Request) {
  const iss = issuer(req);
  return {
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/oauth/token`,
    registration_endpoint: `${iss}/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${iss}/`,
  };
}

/** RFC 9728 protected resource metadata: "this MCP endpoint trusts that issuer". */
export function protectedResourceMetadata(req: Request) {
  return generateProtectedResourceMetadata({
    authServerUrls: [issuer(req)],
    resourceUrl: resourceUrl(req),
    additionalMetadata: {
      scopes_supported: [...SCOPES],
      resource_name: "Agri Prices MCP",
      bearer_methods_supported: ["header"],
    },
  });
}

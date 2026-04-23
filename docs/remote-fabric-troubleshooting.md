# Remote Fabric MCP Troubleshooting

This repo keeps Microsoft’s official `powerbi-modeling-mcp` as the semantic-model layer. For remote/Fabric usage, the main failure points are usually outside this repo.

## Common checks

- Confirm your tenant admin has enabled `Users can use the Power BI Model Context Protocol server endpoint (preview)`.
- Confirm the user or service principal has the required Fabric or Power BI admin/workspace permissions.
- Confirm the semantic model lives in a workspace that supports the required XMLA or remote MCP workflow.

## Service principal caveat

Microsoft documents that RLS is not enforced for service-principal-authenticated remote MCP query execution. Treat that as a hard governance constraint when exposing remote agents to end users.

## If tenant settings are missing

- Verify you are looking in the correct admin portal with the correct admin role.
- Ask a Fabric or Power BI administrator to validate the setting directly.
- If the setting is still absent, assume rollout, tenant policy, or permissions are blocking visibility.

## If authentication fails from a non-VS Code client

- Verify the client is connecting through an MCP-compatible transport rather than treating the endpoint like a generic REST API.
- Reconfirm tenant setting visibility and admin approval.
- Test the same model/workspace path with a known-good MCP client first to isolate client-specific issues.

## Local fallback

If remote/Fabric work is blocked, use this repo in one of these modes:

- `Full`: local semantic-model MCP plus local PBIR authoring
- `PBIROnly`: PBIR authoring only, for report-side automation without semantic-model MCP context

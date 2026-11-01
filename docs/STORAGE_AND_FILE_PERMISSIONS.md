# Storage and File Permissions

| Bucket | Public | Who reads | Who writes |
|---|---|---|---|
| resources-private | no | anyone for whom `can_access_resource(id,'view')` is true, plus staff 'review' | super admin / owning academy staff |
| copyright-evidence | no | super admin / owning academy staff | same |
| covers-public | yes | everyone | super admin (academy covers in Phase 3) |

Object names in `resources-private` are `<resource_id>/<filename>`, so the storage policy resolves the resource and applies the same function as server code. Signed URLs live 60 seconds. Because storage policy re-checks, a free user cannot open a premium file through a guessed URL.

Limit: "view only" cannot stop an authorised viewer from saving what their browser displays. It stops unauthorised access. Download is a separate flag and a separate decision.

Tested against a PGlite stand-in for `storage.objects`. Must be re-verified against real Supabase Storage after the first deploy (signed-URL creation honours the SELECT policy only for the user-scoped client).

# Tuqu Photo API Skill

A local skill package for working with the Tuqu Dream Weaver photo and billing APIs, with a Python helper for consistent request handling.

## Quick Start

Set the optional base URL overrides:

```bash
export TUQU_BASE_URL=https://photo.tuqu.ai
export TUQU_BILLING_BASE_URL=https://billing.tuqu.ai/dream-weaver
```

Authenticated calls must provide a service key explicitly on each request. Do not rely on a shared
credential environment variable; different OpenClaw roles can carry different keys.

Run the bundled helper from the skill directory:

```bash
python3 scripts/tuqu_request.py GET /api/catalog --query type=all
python3 scripts/tuqu_request.py POST /api/enhance-prompt \
  --json '{"category":"portrait","prompt":"soft editorial portrait with window light"}'
python3 scripts/tuqu_request.py POST /api/v2/generate-image \
  --service-key <role-service-key> \
  --json '{"prompt":"cinematic portrait in warm sunset light"}'
python3 scripts/tuqu_request.py POST /api/billing/balance \
  --service-key <role-service-key>
```

The helper auto-selects the correct host and authentication mode for the supported endpoints.

## Features

- Covers Tuqu photo generation, preset application, prompt enhancement, catalog lookup, character management, history, balance, and recharge flows
- Encodes the host and auth rules that are easy to get wrong when calling the APIs manually
- Includes endpoint-level reference docs and workflow recipes for common tasks
- Ships a small Python request helper for repeatable local testing

## Repository Layout

```text
SKILL.md                    Main skill instructions
references/
  endpoints.md              Endpoint request and response details
  workflows.md              Task-oriented API workflows
scripts/
  tuqu_request.py           Local request helper
tests/
  test_tuqu_request.py      Helper unit tests
dist/
  tuqu-photo-skill.skill      Generated skill artifact
```

## Configuration

| Variable | Required For | Notes |
| --- | --- | --- |
| `TUQU_BASE_URL` | Photo, catalog, history, and balance APIs | Defaults to `https://photo.tuqu.ai` |
| `TUQU_BILLING_BASE_URL` | Recharge APIs | Defaults to `https://billing.tuqu.ai/dream-weaver` |

Authenticated requests pass `--service-key <role-service-key>` instead of reading a shared
credential from the environment. The helper maps that value to `userKey`, `x-api-key`, or bearer
`serviceKey` based on the endpoint.

## Common Tasks

- Discover presets and styles: `GET /api/catalog`
- Improve a prompt before generation: `POST /api/enhance-prompt`
- Generate from text or reference images: `POST /api/v2/generate-image`
- Generate from a preset with source images: `GET /api/catalog` then `POST /api/v2/apply-preset`
- Generate with saved characters: `/api/characters` then `POST /api/v2/generate-for-character`
- Check credits: `POST /api/billing/balance`
- Start a recharge flow: `GET /api/v1/recharge/plans`, then `POST /api/v1/recharge/wechat` or `POST /api/v1/recharge/stripe`

## Documentation

- [Skill instructions](./SKILL.md)
- [Endpoint reference](./references/endpoints.md)
- [Workflow recipes](./references/workflows.md)

## Development Notes

- Use `scripts/tuqu_request.py` instead of ad-hoc `curl` when possible.
- Keep the endpoint/auth rules in `SKILL.md` aligned with the helper logic in `scripts/tuqu_request.py`.
- Keep credential handling explicit per request so multiple roles can use different service keys safely.
- Treat `dist/` as generated output.

## License

No license file is currently included in this repository.

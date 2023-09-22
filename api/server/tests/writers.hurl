# Error writer omits `data`

GET {{endpoint}}/api/v1/session

HTTP 401
```json
{"error":{"code":401,"reason":"noSession"}}
```

# Success writer omits `error`

GET {{endpoint}}/healthz

HTTP 200
[Asserts]
jsonpath "$.error" not exists

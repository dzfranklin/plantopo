# Error writer omits `data`

POST {{endpoint}}/api/v1/session

HTTP 400
```json
{"error":{"code":400,"message":"bad request"}}
```

# Success writer omits `error`

GET {{endpoint}}/api/v1/healthz

HTTP 200
[Asserts]
jsonpath "$.error" not exists

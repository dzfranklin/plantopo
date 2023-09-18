POST {{endpoint}}/api/v1/account/password-reset/request
Content-Type: application/json
{
  "email": "nonexistant@test.plantopo.com"
}

HTTP 400
[Asserts]
jsonpath "$.error.reason" == "emailInvalid"

POST {{endpoint}}/api/v1/account/password-reset/request
Content-Type: application/json
{
  "email": "bob@test.plantopo.com"
}

HTTP 200
```json
{}
```

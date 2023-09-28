# TEST: A logged out user gets a null user
GET {{endpoint}}/api/v1/session
HTTP 200
```json
{"data":{"user":null}}
```

# TEST: A logged out user gets a 200 when trying to delete the session
DELETE {{endpoint}}/api/v1/session
HTTP 200

# TEST: If the password is invalid the user gets a message

POST {{endpoint}}/api/v1/session
Content-Type: application/json
{
  "email": "bob@test.plantopo.com",
  "password": "wrongpassword"
}

HTTP 401
[Asserts]
jsonpath "$.error.email" not exists
jsonpath "$.error.details.password" == "is incorrect"

# TEST: A user can log in

POST {{endpoint}}/api/v1/session
Content-Type: application/json
{
  "email": "bob@test.plantopo.com",
  "password": "testpassword"
}

HTTP 200
[Asserts]
cookie "currentUser" exists
jsonpath "$.data.user.id" == "dddddddd-dddd-dddd-dddd-000000000001"
jsonpath "$.data.user.email" == "bob@test.plantopo.com"
jsonpath "$.data.user.fullName" == "Bob Doe"
jsonpath "$.data.user.createdAt" == "2023-09-12T11:05:04Z"
jsonpath "$.data.user.confirmedAt" == "2023-09-12T11:50:19Z"

# A logged in user can GET

GET {{endpoint}}/api/v1/session

HTTP 200
[Asserts]
jsonpath "$.data.user.id" == "dddddddd-dddd-dddd-dddd-000000000001"
jsonpath "$.data.user.fullName" == "Bob Doe"

# A user can log out

DELETE {{endpoint}}/api/v1/session

HTTP 200
[Asserts]

# After logout a user GETs an empty session

GET {{endpoint}}/api/v1/session
HTTP 200
[Asserts]
jsonpath "$.data.user" == null

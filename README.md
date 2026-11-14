

```
# The Mana Ramp

Commander Deck Boxes are ordered on the site and printed by the shop. Customers do not get STL files.

The single admin user is created by hand. The Cognito pool does not allow public sign-up. See [aws/ORDERS.md](aws/ORDERS.md) for the `admin-create-user` commands, the stack order, SES, and the Bedrock model-access step. Pass `-c notifyEmail=you@example.com` at deploy so that address is not hardcoded.

```bash
find . -type f -name '._*' -delete
```
```
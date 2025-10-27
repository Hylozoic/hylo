# Backend Issues Requiring Team Discussion

## Email Reply Address Decoding Bug

**CRITICAL PRODUCTION BUG IDENTIFIED**

**Issue:** `decodePostReplyAddress` returns postId with salt prefix (e.g., `"FFFFAAAA1234567897823"` instead of `"7823"`).

**Root Cause:** Bug in production code at `apps/backend/api/services/Email.js:134`. The code was using:
```javascript
const salt = new RegExp(format('^%s', process.env.INBOUND_EMAIL_SALT))
const plaintext = PlayCrypto.decrypt(match[1]).replace(salt, '')
```

The `.replace(salt, '')` was not effectively removing the salt prefix, causing the postId to include the salt.

**Fix Applied:** Replaced RegExp-based replacement with string methods:
```javascript
const saltStr = process.env.INBOUND_EMAIL_SALT
const match = address.match(/reply-(.*?)@/)
let plaintext = PlayCrypto.decrypt(match[1])
if (plaintext.startsWith(saltStr)) {
  plaintext = plaintext.substring(saltStr.length)
}
const ids = plaintext.split('|')
return { postId: ids[0], userId: ids[1] }
```

**Files Modified:**
- `apps/backend/api/services/Email.js`

**Impact:** **CRITICAL PRODUCTION BUG** - This is causing email reply functionality to fail. The `decodePostReplyAddress` function is called in `CommentController.js` when processing email replies. Without this fix, email replies contain incorrect postIds or fail validation.

**Production Impact:** 
- Email replies are failing or producing incorrect postIds
- Users replying via email are experiencing errors
- Comment creation via email is broken

**Questions for Team:**
1. Have there been any user reports of email replies failing?
2. Should we check recent email reply logs to see if this has been impacting users?
3. This bug suggests email replies haven't been working - when was this functionality last verified?
4. Is there a way to retroactively fix replies that may have been corrupted?

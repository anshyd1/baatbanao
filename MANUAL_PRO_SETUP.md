# Secure manual Pro activation setup

1. Vercel Project → Settings → Environment Variables mein `BB_REDEEM_SECRET` add karein.
2. Value minimum 32 random characters ho. Example banane ke liye: `openssl rand -hex 32`.
3. Same secret ko repository mein commit **mat** karein. Admin machine par environment variable rakhein.
4. Payment screenshot verify karne ke baad code banayein:

```bash
BB_REDEEM_SECRET='your-secret' node tools/generate-redeem-code.js 9876543210 pro
```

5. Generated 10-character code WhatsApp par customer ko dein. Customer wahi phone, selected plan aur code enter kare.

## Important limitation

Code secret ab public browser bundle mein nahi hai. Lekin premium features abhi static browser JavaScript mein hi execute hote hain; a determined technical user client code modify karke UI bypass kar sakta hai. Fully enforceable paid tier ke liye premium operation/server data ko authenticated backend ke peeche rakhna hoga. Current change casual forgery ko rokti hai, payment ko automatically verify nahi karti—admin ko screenshot/UPI statement manually verify karna hai.

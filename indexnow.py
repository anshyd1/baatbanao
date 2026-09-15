#!/usr/bin/env python3
"""
Submit URLs to IndexNow for BaatBanao.shop (Bing, Yandex, etc.)
"""
import urllib.request
import json
import sys

HOST = "www.baatbanao.shop"
KEY = "bb8f64e29c154388b139ec42b08fa110"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"

URLS = [
    f"https://{HOST}/",
    f"https://{HOST}/paise-mangne-ke-message",
    f"https://{HOST}/dost-se-paise-wapas-message",
    f"https://{HOST}/client-invoice-follow-up-message",
    f"https://{HOST}/freelancer-payment-reminder-message",
    f"https://{HOST}/kirana-shop-udhaar-reminder",
    f"https://{HOST}/kirayedaar-rent-reminder-message",
    f"https://{HOST}/tuition-fees-reminder-message",
    f"https://{HOST}/payment-reminder-customer-whatsapp",
    f"https://{HOST}/paise-wapas-mangne-ka-tarika",
    f"https://{HOST}/udhar-funny-shayari",
    f"https://{HOST}/udhaar-khata-kaise-banaayein",
    f"https://{HOST}/upi-payment-link-generator",
    f"https://{HOST}/bhojpuri-udhaar-message",
]

def submit():
    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": URLS
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        "https://api.indexnow.org/IndexNow",
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "BaatBanao-IndexNow"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"IndexNow submission: HTTP {resp.status} - {resp.reason}")
    except Exception as e:
        print(f"IndexNow error: {e}")

if __name__ == "__main__":
    submit()

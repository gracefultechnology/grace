# Stock Cuttlefish x86_64 phone plus Grace's staged overlay (vendor/grace/product.mk, from scripts/aosp.ts).
$(call inherit-product, device/google/cuttlefish/vsoc_x86_64_only/phone/aosp_cf.mk)
$(call inherit-product, vendor/grace/product.mk)
PRODUCT_NAME := grace_cf_x86_64_phone
PRODUCT_DEVICE := vsoc_x86_64_only
PRODUCT_BRAND := Grace
PRODUCT_MODEL := Grace Cuttlefish x86_64

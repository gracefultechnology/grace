$(call inherit-product, device/google/cuttlefish/vsoc_x86_64_only/phone/aosp_cf.mk)
$(call inherit-product, vendor/grace/product.mk)
$(call inherit-product, vendor/grace/browser/browser.mk)
PRODUCT_NAME := grace_cf_x86_64_tablet
PRODUCT_DEVICE := vsoc_x86_64_only
PRODUCT_BRAND := Grace
PRODUCT_MODEL := Grace Cuttlefish x86_64 tablet
PRODUCT_CHARACTERISTICS := tablet
PRODUCT_PACKAGE_OVERLAYS += vendor/grace/overlay
PRODUCT_PRODUCT_PROPERTIES += persist.sys.timezone=America/New_York

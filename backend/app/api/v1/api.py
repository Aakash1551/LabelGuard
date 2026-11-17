from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, products, rules

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Access"])
api_router.include_router(users.router, prefix="/users", tags=["User Administration"])
api_router.include_router(products.router, prefix="/products", tags=["Product Catalog"])
api_router.include_router(rules.router, prefix="/rules", tags=["Compliance Rules Catalog"])

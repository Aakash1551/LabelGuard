import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.database.base import Base
from app.database.session import async_engine
from app.models.user import User
from app.models.rule import ComplianceRule

logger = logging.getLogger("labelguard.init_db")

OFFICIAL_RULES_CATALOG = [
    {
        "rule_code": "PCR-R06-1-A",
        "category": "MANUFACTURER",
        "title": "Manufacturer / Packer / Importer Identity & Address",
        "description": "Every package must declare the name and complete physical address of the manufacturer, or where the manufacturer is not the packer, the name and address of the manufacturer and packer, or for imported goods, the name and address of the importer.",
        "act_reference": "The Legal Metrology Act, 2009 (Section 18)",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    },
    {
        "rule_code": "PCR-R06-1-AA",
        "category": "ORIGIN",
        "title": "Country of Origin Declaration",
        "description": "The name of the country of origin or manufacture or assembly in case of imported products, or clear declaration of country of manufacture on domestic packages.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(aa)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2017.amended"
    },
    {
        "rule_code": "PCR-R06-1-B",
        "category": "COMMODITY",
        "title": "Generic or Common Name of Commodity",
        "description": "The common or generic names of the commodity contained in the package and in case of packages with more than one product, the name and quantity of each product.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(b)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    },
    {
        "rule_code": "PCR-R06-1-C",
        "category": "QUANTITY",
        "title": "Net Quantity in Standard Unit of Measure",
        "description": "The net quantity, in terms of the standard unit of weight or measure, of the commodity contained in the package or where the commodity is packed or sold by number, the number of the commodity contained in the package.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(c) & Rules 11, 12, 13",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    },
    {
        "rule_code": "PCR-R06-1-C-UNIT",
        "category": "QUANTITY",
        "title": "Standard SI Unit Symbols and Syntax",
        "description": "Net quantity symbols must adhere strictly to metric units: 'g' or 'kg' for mass; 'ml', 'mL', or 'l', 'L' for volume; 'm' or 'cm' for length. Non-standard abbreviations such as 'gms', 'kilos', 'ML', 'cc' are strictly prohibited.",
        "act_reference": "The Legal Metrology Act, 2009 (Sections 11 & 18)",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 12 & Rule 13",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    },
    {
        "rule_code": "PCR-R06-1-D",
        "category": "DATE",
        "title": "Month and Year of Manufacture / Packing / Import",
        "description": "The month and year in which the commodity is manufactured or pre-packed or imported shall be clearly mentioned on the package.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(d)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2021.amended"
    },
    {
        "rule_code": "PCR-R06-1-E",
        "category": "MRP",
        "title": "Maximum Retail Price (MRP) Inclusive of All Taxes",
        "description": "The retail sale price of the package shall be declared clearly as 'Maximum or Max. Retail Price Rs. or ₹ .... inclusive of all taxes' or in abbreviation 'MRP Rs. / ₹ .... incl. of all taxes'.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2021.amended"
    },
    {
        "rule_code": "PCR-R06-1-E-USP",
        "category": "MRP",
        "title": "Unit Sale Price (USP) Declaration",
        "description": "Mandatory declaration of Unit Sale Price in Rs. per g/ml (for packages <= 1 kg/1 L) or Rs. per kg/L (for packages > 1 kg/1 L), rounded to nearest two decimal places.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e) (Amended 2021/2022)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2022.amended"
    },
    {
        "rule_code": "PCR-R06-1-N",
        "category": "CONSUMER_CARE",
        "title": "Consumer Care Cell Details (Contact, Phone, Email & Address)",
        "description": "Every package must bear the name, address, telephone number and e-mail address of the person or office which can be contacted by the consumer in case of complaints or queries.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(n)",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    },
    {
        "rule_code": "PCR-R09-1",
        "category": "LEGIBILITY",
        "title": "Prominence, Clarity and Background Contrast of Declarations",
        "description": "Every declaration required under these rules shall be conspicuous, legible and distinctly contrasted with the background of the label or package.",
        "act_reference": "The Legal Metrology Act, 2009",
        "rule_reference": "The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 9",
        "severity": "MANDATORY",
        "is_active": True,
        "version": "2011.amended"
    }
]


async def init_db(session: AsyncSession) -> None:
    """
    Creates tables if they do not exist and populates the database with initial
    superadmin and statutory rule catalog.
    """
    # 1. Create database schema tables
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 2. Seed Superuser
    stmt = select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL.lower())
    result = await session.execute(stmt)
    superuser = result.scalar_one_or_none()

    if not superuser:
        logger.info(f"Creating initial superuser: {settings.FIRST_SUPERUSER_EMAIL}")
        superuser = User(
            email=settings.FIRST_SUPERUSER_EMAIL.lower(),
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            full_name=settings.FIRST_SUPERUSER_FULLNAME,
            role="ADMIN",
            is_active=True
        )
        session.add(superuser)
        await session.commit()
    else:
        logger.info(f"Initial superuser already exists: {settings.FIRST_SUPERUSER_EMAIL}")

    # 3. Seed Official Legal Metrology Rules Catalog
    for rule_data in OFFICIAL_RULES_CATALOG:
        stmt = select(ComplianceRule).where(ComplianceRule.rule_code == rule_data["rule_code"])
        result = await session.execute(stmt)
        existing_rule = result.scalar_one_or_none()
        if not existing_rule:
            rule = ComplianceRule(**rule_data)
            session.add(rule)

    await session.commit()
    logger.info("Statutory Legal Metrology rule catalog verified and initialized.")

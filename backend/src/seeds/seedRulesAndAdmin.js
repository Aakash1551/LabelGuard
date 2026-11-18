const User = require('../models/User');
const ComplianceRule = require('../models/ComplianceRule');

const OFFICIAL_RULES_CATALOG = [
  {
    ruleCode: 'PCR-R06-1-A',
    category: 'MANUFACTURER',
    title: 'Manufacturer / Packer / Importer Identity & Address',
    description: 'Every package must declare the name and complete physical address of the manufacturer, or where the manufacturer is not the packer, the name and address of the manufacturer and packer, or for imported goods, the name and address of the importer.',
    actReference: 'The Legal Metrology Act, 2009 (Section 18)',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
  {
    ruleCode: 'PCR-R06-1-AA',
    category: 'ORIGIN',
    title: 'Country of Origin Declaration',
    description: 'The name of the country of origin or manufacture or assembly in case of imported products, or clear declaration of country of manufacture on domestic packages.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(aa)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2017.amended',
  },
  {
    ruleCode: 'PCR-R06-1-B',
    category: 'COMMODITY',
    title: 'Generic or Common Name of Commodity',
    description: 'The common or generic names of the commodity contained in the package and in case of packages with more than one product, the name and quantity of each product.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(b)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
  {
    ruleCode: 'PCR-R06-1-C',
    category: 'QUANTITY',
    title: 'Net Quantity in Standard Unit of Measure',
    description: 'The net quantity, in terms of the standard unit of weight or measure, of the commodity contained in the package or where the commodity is packed or sold by number, the number of the commodity contained in the package.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(c) & Rules 11, 12, 13',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
  {
    ruleCode: 'PCR-R06-1-C-UNIT',
    category: 'QUANTITY',
    title: 'Standard SI Unit Symbols and Syntax',
    description: "Net quantity symbols must adhere strictly to metric units: 'g' or 'kg' for mass; 'ml', 'mL', or 'l', 'L' for volume; 'm' or 'cm' for length. Non-standard abbreviations such as 'gms', 'kilos', 'ML', 'cc' are strictly prohibited.",
    actReference: 'The Legal Metrology Act, 2009 (Sections 11 & 18)',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 12 & Rule 13',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
  {
    ruleCode: 'PCR-R06-1-D',
    category: 'DATE',
    title: 'Month and Year of Manufacture / Packing / Import',
    description: 'The month and year in which the commodity is manufactured or pre-packed or imported shall be clearly mentioned on the package.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(d)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2021.amended',
  },
  {
    ruleCode: 'PCR-R06-1-E',
    category: 'MRP',
    title: 'Maximum Retail Price (MRP) Inclusive of All Taxes',
    description: "The retail sale price of the package shall be declared clearly as 'Maximum or Max. Retail Price Rs. or ₹ .... inclusive of all taxes' or in abbreviation 'MRP Rs. / ₹ .... incl. of all taxes'.",
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2021.amended',
  },
  {
    ruleCode: 'PCR-R06-1-E-USP',
    category: 'MRP',
    title: 'Unit Sale Price (USP) Declaration',
    description: 'Mandatory declaration of Unit Sale Price in Rs. per g/ml (for packages <= 1 kg/1 L) or Rs. per kg/L (for packages > 1 kg/1 L), rounded to nearest two decimal places.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e) (Amended 2021/2022)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2022.amended',
  },
  {
    ruleCode: 'PCR-R06-1-N',
    category: 'CONSUMER_CARE',
    title: 'Consumer Care Cell Details (Contact, Phone, Email & Address)',
    description: 'Every package must bear the name, address, telephone number and e-mail address of the person or office which can be contacted by the consumer in case of complaints or queries.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(n)',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
  {
    ruleCode: 'PCR-R09-1',
    category: 'LEGIBILITY',
    title: 'Prominence, Clarity and Background Contrast of Declarations',
    description: 'Every declaration required under these rules shall be conspicuous, legible and distinctly contrasted with the background of the label or package.',
    actReference: 'The Legal Metrology Act, 2009',
    ruleReference: 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 9',
    severity: 'MANDATORY',
    isActive: true,
    version: '2011.amended',
  },
];

const seedRulesAndAdmin = async () => {
  // 1. Seed Superadmin
  const adminEmail = process.env.FIRST_SUPERUSER_EMAIL || 'admin@labelguard.ai';
  const adminPassword = process.env.FIRST_SUPERUSER_PASSWORD || 'AdminSecurePassword123!';
  const adminName = process.env.FIRST_SUPERUSER_FULLNAME || 'LabelGuard Chief Inspector';

  let admin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!admin) {
    admin = await User.create({
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      fullName: adminName,
      role: 'ADMIN',
      isActive: true,
    });
    console.log(`[Seed] Superadmin created: ${adminEmail}`);
  }

  // 2. Seed PCR 2011 Rules
  for (const rule of OFFICIAL_RULES_CATALOG) {
    await ComplianceRule.findOneAndUpdate(
      { ruleCode: rule.ruleCode },
      { $setOnInsert: rule },
      { upsert: true, new: true }
    );
  }
  console.log('[Seed] Verified and loaded 10 official Legal Metrology (PCR 2011) rules.');
};

module.exports = seedRulesAndAdmin;

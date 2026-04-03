/* ==========================================================================
   Programmatic SEO — Niche landing page data
   Each niche has genuinely differentiated content: cost examples, ingredients,
   benchmarks, tips, and FAQs specific to that food category.
   ========================================================================== */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostLineItem {
  label: string;
  amount: string;
}

export interface CostComparison {
  productName: string;
  ingredientOnly: {
    items: CostLineItem[];
    total: string;
  };
  trueCost: {
    ingredientTotal: string;
    laborHours: string;
    laborCost: string;
    packaging: string;
    overhead: string;
    platformFees: string;
    total: string;
  };
  hiddenCost: string;
  hiddenCostLabel: string;
}

export interface NicheIngredient {
  name: string;
  typicalCost: string;
  costDriver: string;
}

export interface IndustryBenchmark {
  metric: string;
  value: string;
  context: string;
}

export interface FAQ {
  question: string;
  answer: string;
  slug: string;
}

export interface NicheTip {
  title: string;
  body: string;
}

export interface NicheLanding {
  slug: string;
  keyword: string;

  // Meta
  title: string;
  description: string;

  // Hero
  heroHeadline: string;
  heroSubheadline: string;
  heroCta: string;
  heroBadges: string[];

  // Cost comparison
  costComparison: CostComparison;

  // Ingredients
  ingredientsSectionTitle: string;
  ingredients: NicheIngredient[];

  // Benchmarks
  benchmarks: IndustryBenchmark[];

  // Tips
  tips: NicheTip[];

  // FAQs
  faqs: FAQ[];

  // Final CTA
  ctaHeadline: string;
  ctaSubtext: string;

  // Related niches (slugs for cross-linking)
  related: string[];
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const NICHE_LANDINGS: NicheLanding[] = [
  // =========================================================================
  // 1. Food Cost Calculator (broadest, highest volume)
  // =========================================================================
  {
    slug: 'food-cost-calculator',
    keyword: 'food cost calculator',
    title: 'Food Cost Calculator — Know Your True Cost | RecipePricer',
    description:
      'Free food cost calculator for home food businesses. Calculate ingredient cost, labor, packaging, and overhead to find your true cost per serving and recommended selling price.',
    heroHeadline: 'Food Cost Calculator',
    heroSubheadline:
      'Most food makers only count ingredients. Your true cost — labor, packaging, overhead — is 3-5x higher. Find out exactly where your money goes.',
    heroCta: 'Calculate your true food cost — free',
    heroBadges: ['Free cost breakdown', 'No account needed', 'Works for any food product'],
    costComparison: {
      productName: 'a batch of homemade pasta sauce (12 jars)',
      ingredientOnly: {
        items: [
          { label: 'San Marzano tomatoes (2 cans)', amount: '$7.98' },
          { label: 'Olive oil', amount: '$2.40' },
          { label: 'Garlic, onions, basil', amount: '$3.15' },
          { label: 'Salt, pepper, oregano', amount: '$0.60' },
          { label: 'Jars & lids', amount: '$8.40' },
        ],
        total: '$22.53',
      },
      trueCost: {
        ingredientTotal: '$22.53',
        laborHours: '3.5',
        laborCost: '$52.50',
        packaging: '$6.00',
        overhead: '$4.50',
        platformFees: '$3.00',
        total: '$88.53',
      },
      hiddenCost: '$66.00',
      hiddenCostLabel: 'hidden cost per batch you\'re absorbing',
    },
    ingredientsSectionTitle: 'Common cost drivers in food businesses',
    ingredients: [
      { name: 'Meat & protein', typicalCost: '$4–12/lb', costDriver: 'Highest per-unit cost; price swings weekly based on supply' },
      { name: 'Dairy (cream, cheese)', typicalCost: '$3–8/lb', costDriver: 'Short shelf life means waste if you overbuy' },
      { name: 'Cooking oils', typicalCost: '$0.15–0.40/oz', costDriver: 'Used in nearly every recipe; cost adds up across batches' },
      { name: 'Fresh herbs & spices', typicalCost: '$2–5/bunch', costDriver: 'Low per-recipe cost but high waste rate (40-60% unused)' },
      { name: 'Packaging (jars, bags, boxes)', typicalCost: '$0.50–2.00/unit', costDriver: 'Often forgotten in cost calculations; minimum order quantities tie up cash' },
      { name: 'Specialty ingredients', typicalCost: 'Varies widely', costDriver: 'Truffle oil, saffron, high-end vanilla — small amounts, big impact on margin' },
    ],
    benchmarks: [
      { metric: 'Target food cost ratio', value: '25–35%', context: 'Your ingredient + labor cost should be 25-35% of your selling price for a healthy margin' },
      { metric: 'Average hidden cost multiplier', value: '3–5x', context: 'True cost is typically 3-5x the ingredient-only cost when you include labor and overhead' },
      { metric: 'Packaging cost share', value: '5–15%', context: 'Packaging often accounts for 5-15% of total cost, especially for jarred or boxed products' },
      { metric: 'Waste factor', value: '5–10%', context: 'Plan for 5-10% ingredient waste from spills, trimmings, and failed batches' },
    ],
    tips: [
      { title: 'Track your time honestly', body: 'Most food makers undercount their labor by 30-50%. Include prep, cooking, cooling, packaging, cleaning, and delivery time. If a batch takes 4 hours total, that\'s 4 hours — not just the 45 minutes of active cooking.' },
      { title: 'Price by the unit, not the batch', body: 'A $90 batch of sauce sounds expensive, but at 12 jars that\'s $7.50 each. Compare your per-unit cost to your per-unit price to see your actual margin on every sale.' },
      { title: 'Revisit costs quarterly', body: 'Ingredient prices shift seasonally. A recipe that was profitable in January might be losing money by June. Recalculate every 3 months or when you notice a price jump at the store.' },
    ],
    faqs: [
      { question: 'What is food cost percentage?', answer: 'Food cost percentage is the ratio of your total food cost to your selling price. For example, if your ingredients and labor cost $3 and you sell for $10, your food cost percentage is 30%. Most profitable food businesses aim for 25-35%.', slug: 'food-cost-percentage' },
      { question: 'How do I calculate food cost per serving?', answer: 'Add up all ingredient costs for the full recipe, then divide by the number of servings or units it produces. Don\'t forget to include waste — if you buy 5 lbs of chicken but only use 4 lbs after trimming, cost the full 5 lbs.', slug: 'cost-per-serving' },
      { question: 'Should I include my time in food cost?', answer: 'Yes. Your time is real money. If you spend 3 hours making a batch and could earn $15/hr elsewhere, that\'s $45 in labor cost. Most home food makers ignore labor and wonder why they\'re not profitable.', slug: 'include-labor' },
      { question: 'How do I account for overhead in a home kitchen?', answer: 'Estimate your monthly kitchen-related costs (utilities, equipment wear, cleaning supplies, permits) and divide by the number of batches you make per month. Even $50/month in overhead adds $2-5 per batch.', slug: 'home-overhead' },
      { question: 'What\'s a good profit margin for homemade food?', answer: 'Aim for a 60-70% gross margin (cost = 30-40% of price). This sounds high, but after accounting for unsold inventory, delivery costs, and your time marketing, your net margin will be much lower.', slug: 'profit-margin' },
    ],
    ctaHeadline: 'Stop undercharging.\nStart knowing your numbers.',
    ctaSubtext: 'Most home food makers undercharge by 40-60%. Find your true cost in 3 minutes.',
    related: ['baking-cost-calculator', 'bbq-cost-calculator', 'cake-cost-calculator'],
  },

  // =========================================================================
  // 2. Baking Cost Calculator
  // =========================================================================
  {
    slug: 'baking-cost-calculator',
    keyword: 'baking cost calculator',
    title: 'Baking Cost Calculator — Price Your Baked Goods | RecipePricer',
    description:
      'Free baking cost calculator for home bakers and cottage food sellers. Calculate ingredient cost, labor, and overhead for cookies, cakes, bread, and pastries.',
    heroHeadline: 'Baking Cost Calculator',
    heroSubheadline:
      'Flour is cheap. Your time isn\'t. See the real cost behind every batch — ingredients, labor, packaging, overhead — and find a price you can actually charge.',
    heroCta: 'Calculate your baking costs — free',
    heroBadges: ['Free cost breakdown', 'Built-in unit conversion', 'Cups, grams, ounces — automatic'],
    costComparison: {
      productName: 'a batch of 24 cinnamon rolls',
      ingredientOnly: {
        items: [
          { label: 'Bread flour (3 cups)', amount: '$1.20' },
          { label: 'Butter (1 cup)', amount: '$3.50' },
          { label: 'Brown sugar, cinnamon', amount: '$1.80' },
          { label: 'Cream cheese, powdered sugar', amount: '$3.40' },
          { label: 'Yeast, milk, eggs', amount: '$2.10' },
        ],
        total: '$12.00',
      },
      trueCost: {
        ingredientTotal: '$12.00',
        laborHours: '4',
        laborCost: '$60.00',
        packaging: '$6.00',
        overhead: '$3.50',
        platformFees: '$2.00',
        total: '$83.50',
      },
      hiddenCost: '$71.50',
      hiddenCostLabel: 'hidden cost per batch — mostly your time',
    },
    ingredientsSectionTitle: 'Common baking ingredients & their cost impact',
    ingredients: [
      { name: 'All-purpose flour', typicalCost: '$0.40–0.70/lb', costDriver: 'Cheap per batch, but you go through 5-10 lbs/week as a regular baker' },
      { name: 'Butter', typicalCost: '$4–6/lb', costDriver: 'One of the highest per-recipe costs; butter-heavy items (croissants, pound cake) need careful pricing' },
      { name: 'Vanilla extract (pure)', typicalCost: '$3–5/oz', costDriver: 'A single tablespoon costs $1.50-2.50 — it adds up fast in vanilla-forward recipes' },
      { name: 'Chocolate (chips, bars)', typicalCost: '$3–8/lb', costDriver: 'Quality matters for taste but doubles your ingredient cost vs. generic' },
      { name: 'Eggs', typicalCost: '$0.25–0.50/each', costDriver: 'Price fluctuates seasonally; a recipe with 6 eggs is $1.50-3.00 just for eggs' },
      { name: 'Cream cheese', typicalCost: '$2.50–4/8oz', costDriver: 'Essential for frostings and cheesecakes; short shelf life means waste if unused' },
      { name: 'Specialty flours (almond, coconut)', typicalCost: '$4–10/lb', costDriver: 'Gluten-free baking costs 3-5x more in flour alone' },
    ],
    benchmarks: [
      { metric: 'Typical ingredient cost ratio', value: '20–30%', context: 'Baked goods have relatively low ingredient costs — the majority of cost is labor' },
      { metric: 'Labor share of total cost', value: '40–60%', context: 'Mixing, proofing, shaping, decorating, and cleanup take more time than you think' },
      { metric: 'Average markup for cottage food', value: '3–4x', context: 'Price your baked goods at 3-4x your total cost (ingredients + labor + overhead)' },
      { metric: 'Waste rate for baked goods', value: '3–8%', context: 'Burned batches, crumbled decorations, and test runs — budget for at least 5% waste' },
    ],
    tips: [
      { title: 'Weigh ingredients, don\'t measure by volume', body: 'A "cup of flour" can vary from 120g to 180g depending on how you scoop. Weighing ensures consistent products and accurate costing. Invest in a $15 kitchen scale — it pays for itself in one month of accurate pricing.' },
      { title: 'Calculate your real hourly rate', body: 'Add up everything: mixing, proofing time, baking, cooling, decorating, packaging, cleanup, and delivery. Most bakers work 2-3x longer than they estimate. If you want to earn $20/hr, you need to know exactly how many hours each batch takes.' },
      { title: 'Don\'t forget cottage food permit costs', body: 'Annual permits ($25-500 depending on your state), food handler certifications, and kitchen inspections are real costs. Divide your annual permit cost by your expected batches per year and add it to overhead.' },
    ],
    faqs: [
      { question: 'How do I price homemade baked goods?', answer: 'Start by calculating your true cost per item (ingredients + labor + packaging + overhead), then apply a markup. Most cottage food bakers price at 3-4x their total cost. For example, if a dozen cookies costs $8 to make (including your time), price them at $24-32.', slug: 'price-baked-goods' },
      { question: 'How much should I charge per hour for baking?', answer: 'Research your local market, but $15-25/hr is common for cottage food bakers. Remember: your hourly rate isn\'t just for mixing — it includes all the invisible time (proofing, cooling, decorating, cleaning, marketing, delivery).', slug: 'hourly-rate' },
      { question: 'Should I use cups or grams for costing?', answer: 'Grams. A cup of flour ranges from 120-180g depending on how you scoop, which means your ingredient cost per batch varies by up to 50%. Weighing in grams gives you consistent costs and consistent products. RecipePricer converts between cups, grams, and ounces automatically.', slug: 'cups-vs-grams' },
      { question: 'How do I calculate packaging cost for baked goods?', answer: 'List every packaging item per order: box, tissue paper, sticker, ribbon, bag, business card. It adds up to $1-3 per order. For cookies: cellophane bags ($0.10), sticker labels ($0.08), boxes ($0.50-1.50). Track it once and add it to your calculator.', slug: 'packaging-cost' },
      { question: 'Is cottage food baking profitable?', answer: 'It can be — if you price correctly. The most common mistake is pricing based on ingredients only. When you add labor, packaging, and overhead, many cottage food bakers discover they\'re earning less than minimum wage. The fix isn\'t to work faster; it\'s to charge more.', slug: 'cottage-food-profit' },
    ],
    ctaHeadline: 'Your flour is cheap.\nYour time isn\'t.',
    ctaSubtext: 'Most bakers undercharge by 40-60%. Find out what your baked goods really cost.',
    related: ['cake-cost-calculator', 'cookie-pricing-calculator', 'bread-cost-calculator'],
  },

  // =========================================================================
  // 3. Cake Cost Calculator
  // =========================================================================
  {
    slug: 'cake-cost-calculator',
    keyword: 'cake cost calculator',
    title: 'Cake Cost Calculator — Price Custom Cakes | RecipePricer',
    description:
      'Free cake cost calculator for home bakers. Calculate ingredient, labor, and decorating costs for custom cakes, wedding cakes, and birthday cakes. Find your true price per cake.',
    heroHeadline: 'Cake Cost Calculator',
    heroSubheadline:
      'Custom cakes are labor-intensive — decorating alone can be 60-70% of your total cost. See the real numbers behind every layer, every tier, every fondant flower.',
    heroCta: 'Calculate your cake costs — free',
    heroBadges: ['Free cost breakdown', 'Per-serving pricing', 'Tiered cake support'],
    costComparison: {
      productName: 'a 3-tier fondant wedding cake (serves 100)',
      ingredientOnly: {
        items: [
          { label: 'Cake flour, sugar, eggs (3 tiers)', amount: '$18.50' },
          { label: 'Butter & cream (filling)', amount: '$12.00' },
          { label: 'Fondant (5 lbs)', amount: '$15.00' },
          { label: 'Gum paste flowers', amount: '$8.00' },
          { label: 'Food coloring, extracts', amount: '$4.50' },
        ],
        total: '$58.00',
      },
      trueCost: {
        ingredientTotal: '$58.00',
        laborHours: '14',
        laborCost: '$280.00',
        packaging: '$25.00',
        overhead: '$18.00',
        platformFees: '$0.00',
        total: '$381.00',
      },
      hiddenCost: '$323.00',
      hiddenCostLabel: 'hidden cost per cake — mostly decorating labor',
    },
    ingredientsSectionTitle: 'Cake-specific ingredients & cost drivers',
    ingredients: [
      { name: 'Fondant', typicalCost: '$3–6/lb', costDriver: 'A 3-tier cake uses 5-8 lbs; fondant cakes cost 2-3x more than buttercream in materials' },
      { name: 'Butter', typicalCost: '$4–6/lb', costDriver: 'Buttercream frosting alone uses 2-4 lbs of butter per tiered cake' },
      { name: 'Cake flour', typicalCost: '$0.50–0.80/lb', costDriver: 'Low per-batch cost, but you need 3-5 lbs for a tiered cake' },
      { name: 'Heavy cream', typicalCost: '$4–6/quart', costDriver: 'Ganache and whipped fillings go through cream fast; short shelf life' },
      { name: 'Structural materials', typicalCost: '$5–15/cake', costDriver: 'Dowels, cake boards, drums, and boxes — invisible to the customer but real costs' },
      { name: 'Gum paste & modeling chocolate', typicalCost: '$5–12/lb', costDriver: 'Sugar flowers and figurines are time-intensive and material-costly' },
    ],
    benchmarks: [
      { metric: 'Labor share for custom cakes', value: '60–70%', context: 'Decorating time dominates cake costs — a 3-tier cake can take 10-16 hours of work' },
      { metric: 'Wedding cake price per serving', value: '$4–12', context: 'Market range is wide; $6-8/serving is a common sweet spot for home bakers' },
      { metric: 'Birthday cake (8" round)', value: '$35–75', context: 'A buttercream 8" cake costs $15-25 to make; price at $35-75 depending on design complexity' },
      { metric: 'Consultation time (unpaid)', value: '1–3 hrs', context: 'Tastings, design consultations, and email back-and-forth are labor costs most bakers ignore' },
    ],
    tips: [
      { title: 'Charge for design complexity, not just size', body: 'A simple 8" buttercream cake and an 8" fondant cake with sugar flowers are the same size but wildly different in cost. Price by the hour of decorating work, not just by the serving.' },
      { title: 'Factor in structural materials', body: 'Dowels, cake boards, cake drums, and delivery boxes cost $5-15 per tiered cake. Clients never see these items, but you pay for them every time. Add them to your overhead or line-item them directly.' },
      { title: 'Track consultation time', body: 'Tastings, design meetings, Pinterest board reviews, and revision emails are unpaid labor for most cake makers. If consultations take 2+ hours, consider a consultation fee ($25-50) that\'s credited toward the order.' },
    ],
    faqs: [
      { question: 'How much should I charge for a custom cake?', answer: 'Calculate your true cost first (ingredients + labor + structural materials + overhead), then apply a 2.5-3.5x markup. A 3-tier wedding cake that costs $380 to make should price at $950-1,330. Your decorating skill level and local market also matter — research what other custom cake makers in your area charge.', slug: 'custom-cake-price' },
      { question: 'How do I calculate the cost of a wedding cake?', answer: 'A wedding cake has 5 cost layers: (1) ingredients per tier, (2) decorating labor at your hourly rate, (3) structural materials (dowels, boards, drums), (4) delivery (gas + time + risk), and (5) consultation time. Most bakers only count #1 and wonder why they\'re not profitable.', slug: 'wedding-cake-cost' },
      { question: 'Should I charge per serving or per cake?', answer: 'Both work. Per-serving pricing ($4-12/serving) is easier for customers to compare. Per-cake pricing gives you more control over margin. Many cake makers use per-serving as a starting point, then adjust up for complex designs.', slug: 'per-serving-pricing' },
      { question: 'How do I account for cake delivery costs?', answer: 'Delivery is a real cost: gas, your time (1-3 hours round trip), and the risk of damage. Charge a delivery fee ($25-75 depending on distance) or build it into your cake price. Never offer free delivery — you\'re just hiding the cost from yourself.', slug: 'delivery-cost' },
    ],
    ctaHeadline: 'Your cakes are worth more\nthan you\'re charging.',
    ctaSubtext: 'Most cake makers undercharge because they only count ingredients. See your true cost per cake.',
    related: ['baking-cost-calculator', 'cookie-pricing-calculator', 'food-cost-calculator'],
  },

  // =========================================================================
  // 4. Cookie Pricing Calculator
  // =========================================================================
  {
    slug: 'cookie-pricing-calculator',
    keyword: 'cookie pricing calculator',
    title: 'Cookie Pricing Calculator — Price Per Dozen | RecipePricer',
    description:
      'Free cookie pricing calculator for home bakers. Calculate cost per cookie and per dozen, including ingredients, decorating time, and packaging. Find your profitable price.',
    heroHeadline: 'Cookie Pricing Calculator',
    heroSubheadline:
      'A batch of cookies looks cheap to make — until you count decorating time, packaging, and the 45 minutes of cleanup. See what each cookie actually costs you.',
    heroCta: 'Calculate your cookie costs — free',
    heroBadges: ['Free cost breakdown', 'Per-cookie & per-dozen pricing', 'Decorating time included'],
    costComparison: {
      productName: 'a batch of 36 decorated sugar cookies',
      ingredientOnly: {
        items: [
          { label: 'Flour, sugar, butter, eggs', amount: '$4.80' },
          { label: 'Royal icing (powdered sugar, meringue)', amount: '$3.20' },
          { label: 'Food coloring (4 colors)', amount: '$2.00' },
          { label: 'Vanilla extract', amount: '$1.50' },
          { label: 'Sprinkles & decorations', amount: '$1.80' },
        ],
        total: '$13.30',
      },
      trueCost: {
        ingredientTotal: '$13.30',
        laborHours: '5',
        laborCost: '$75.00',
        packaging: '$12.00',
        overhead: '$3.00',
        platformFees: '$4.00',
        total: '$107.30',
      },
      hiddenCost: '$94.00',
      hiddenCostLabel: 'hidden cost per batch — decorating is the biggest expense',
    },
    ingredientsSectionTitle: 'Cookie-specific ingredients & cost drivers',
    ingredients: [
      { name: 'Butter', typicalCost: '$4–6/lb', costDriver: 'A double batch of butter cookies uses 1-2 lbs; the single biggest ingredient cost' },
      { name: 'Royal icing supplies', typicalCost: '$2–4/batch', costDriver: 'Meringue powder, powdered sugar, and gel colors — small per-batch but adds up' },
      { name: 'Chocolate chips', typicalCost: '$3–5/12oz', costDriver: 'Quality chocolate doubles your ingredient cost but commands higher prices' },
      { name: 'Cellophane bags & boxes', typicalCost: '$0.10–0.50/unit', costDriver: 'A dozen cookies in a box with ribbon and sticker costs $1.50-3.00 in packaging' },
      { name: 'Sprinkles & decorations', typicalCost: '$3–8/container', costDriver: 'Specialty sprinkle mixes are expensive; budget brands work for most orders' },
      { name: 'Sticker labels', typicalCost: '$0.05–0.15/each', costDriver: 'Custom branded stickers add professionalism but cost $30-60 per roll of 500' },
    ],
    benchmarks: [
      { metric: 'Plain cookies (per dozen)', value: '$12–18', context: 'Chocolate chip, snickerdoodle, oatmeal — fast to make, low decoration time' },
      { metric: 'Decorated sugar cookies (per dozen)', value: '$36–72', context: 'Royal icing decorated cookies take 2-5 minutes EACH to decorate — that\'s 1-3 hours per dozen' },
      { metric: 'Decorating time per cookie', value: '2–5 min', context: 'This is the cost most cookie bakers underestimate. 36 cookies × 3 min = almost 2 hours just decorating' },
      { metric: 'Packaging cost per order', value: '$1.50–3.00', context: 'Boxes, tissue, stickers, ribbon, and business cards — always include in your pricing' },
    ],
    tips: [
      { title: 'Time your decorating', body: 'Sit down with a timer and decorate 12 cookies. Most bakers think it takes 1 minute per cookie — it\'s actually 2-5 minutes for any design with more than one color. That difference is $20-60 in labor per batch of 36.' },
      { title: 'Set minimum order quantities', body: 'A dozen cookies takes almost as long to set up for as three dozen. The mixing, baking, and cleanup time is mostly fixed. Setting a 2-dozen minimum ensures your per-cookie cost is low enough to be profitable.' },
      { title: 'Price by complexity tier', body: 'Create 3 pricing tiers: Simple (one color, $3/cookie), Standard (2-3 colors, $4-5/cookie), and Custom (detailed art, $6-8/cookie). This lets customers self-select and ensures complex orders are priced for the extra time.' },
    ],
    faqs: [
      { question: 'How much should I charge per cookie?', answer: 'It depends on decoration complexity. Plain cookies: $1-1.50 each ($12-18/dozen). Decorated sugar cookies: $3-6 each ($36-72/dozen). The difference is almost entirely decorating labor — a decorated cookie takes 2-5 minutes of skilled handwork.', slug: 'price-per-cookie' },
      { question: 'Why are decorated cookies so expensive?', answer: 'Because decorating time is the cost, not ingredients. A batch of 36 sugar cookies costs ~$13 in ingredients but ~$75 in labor (5 hours of mixing, baking, cooling, and decorating). Add packaging and overhead, and each cookie costs $3+ to make before any profit.', slug: 'why-expensive' },
      { question: 'How do I price cookie platters for events?', answer: 'Calculate your per-cookie cost (including labor and packaging), multiply by the number of cookies, then add a platter arrangement fee ($10-25 for the extra time assembling and making it look beautiful). A 3-dozen decorated platter typically prices at $120-200.', slug: 'event-platters' },
      { question: 'Should I offer free samples?', answer: 'Only if it\'s a calculated marketing expense. One dozen samples costs you $20-30 in real cost (not just $4 in ingredients). If a sample leads to a $150 order, it\'s worth it. Budget your samples like advertising — set a monthly limit.', slug: 'free-samples' },
      { question: 'How do I handle rush orders?', answer: 'Charge a rush fee (25-50% surcharge). Rush orders disrupt your schedule and may require you to buy ingredients at retail instead of bulk prices. A $100 order with 48-hour turnaround should be $125-150.', slug: 'rush-orders' },
    ],
    ctaHeadline: 'Your cookies cost more\nthan you think.',
    ctaSubtext: 'Ingredients are the smallest part. See the real cost of every batch.',
    related: ['baking-cost-calculator', 'cake-cost-calculator', 'bread-cost-calculator'],
  },

  // =========================================================================
  // 5. BBQ Cost Calculator
  // =========================================================================
  {
    slug: 'bbq-cost-calculator',
    keyword: 'bbq cost calculator',
    title: 'BBQ Cost Calculator — Price Smoked Meat | RecipePricer',
    description:
      'Free BBQ cost calculator for pitmasters and BBQ vendors. Calculate meat cost after shrinkage, fuel, labor for long smokes, and overhead. Price per pound of cooked meat.',
    heroHeadline: 'BBQ Cost Calculator',
    heroSubheadline:
      'A 15 lb brisket shrinks to 8 lbs after smoking. That $3.99/lb raw becomes $7.49/lb cooked — before you even count your 14 hours of smoke time. Know your real numbers.',
    heroCta: 'Calculate your BBQ costs — free',
    heroBadges: ['Free cost breakdown', 'Shrinkage calculator built in', 'Per-pound cooked pricing'],
    costComparison: {
      productName: 'one whole brisket (15 lbs raw → 8 lbs cooked)',
      ingredientOnly: {
        items: [
          { label: 'Whole packer brisket (15 lbs)', amount: '$59.85' },
          { label: 'Dry rub (salt, pepper, garlic)', amount: '$2.50' },
          { label: 'Injection marinade', amount: '$3.00' },
          { label: 'Wood chunks (post oak)', amount: '$4.50' },
          { label: 'Butcher paper', amount: '$1.50' },
        ],
        total: '$71.35',
      },
      trueCost: {
        ingredientTotal: '$71.35',
        laborHours: '16',
        laborCost: '$240.00',
        packaging: '$8.00',
        overhead: '$12.00',
        platformFees: '$5.00',
        total: '$336.35',
      },
      hiddenCost: '$265.00',
      hiddenCostLabel: 'hidden cost per brisket — time and shrinkage are the killers',
    },
    ingredientsSectionTitle: 'BBQ-specific cost drivers',
    ingredients: [
      { name: 'Brisket (whole packer)', typicalCost: '$3–6/lb raw', costDriver: 'After 40-50% shrinkage, your real cost is $6-12/lb cooked weight' },
      { name: 'Pork shoulder/butt', typicalCost: '$2–4/lb raw', costDriver: '35-45% weight loss after pulling; cheaper than brisket but still significant shrinkage' },
      { name: 'Ribs (spare or baby back)', typicalCost: '$3–7/lb', costDriver: 'Bone weight is 30-40% — you\'re paying for bones you don\'t serve' },
      { name: 'Charcoal / pellets', typicalCost: '$15–30/cook', costDriver: 'A 14-hour smoke burns 15-20 lbs of charcoal or 20-40 lbs of pellets' },
      { name: 'Wood chunks (hickory, oak, cherry)', typicalCost: '$8–15/bag', costDriver: 'Flavor wood is a real cost; competition BBQ teams spend $50+/month on wood' },
      { name: 'Sauces & rubs', typicalCost: '$1–5/batch', costDriver: 'Homemade sauces use quality ingredients; commercial sauce is cheaper but less distinctive' },
    ],
    benchmarks: [
      { metric: 'Brisket shrinkage (raw → cooked)', value: '40–50%', context: '15 lbs raw yields 7.5-9 lbs of sliced/chopped brisket after cooking and trimming' },
      { metric: 'Pulled pork shrinkage', value: '35–45%', context: '20 lbs raw pork shoulder yields 11-13 lbs of pulled pork' },
      { metric: 'Fuel cost per long smoke', value: '$15–30', context: 'Charcoal/pellets for 10-16 hour cooks — factor this in, not just the meat' },
      { metric: 'Competition BBQ overhead', value: '$200–500/event', context: 'Entry fees, travel, supplies, and meat for a single KCBS or SCA competition' },
    ],
    tips: [
      { title: 'Always price by cooked weight', body: 'A 15 lb brisket at $3.99/lb ($59.85) yields 8 lbs of cooked meat — that\'s $7.48/lb in meat cost alone. When you sell pulled pork at $12/lb, you need to know your real cost is $7-8/lb, not the $3-4/lb raw price.' },
      { title: 'Track your fuel separately', body: 'A 14-hour smoke uses $15-30 in charcoal or pellets. Over a month of weekend cooks, that\'s $60-120 in fuel. Add it to your per-cook cost — it\'s not free just because it doesn\'t come from the grocery store.' },
      { title: 'Factor in overnight monitoring time', body: 'That "low and slow" cook often means waking up at 3 AM to check temps, or running your smoker overnight. If you\'re losing sleep, that\'s labor — even if you\'re not actively working the entire time. Be honest about the time commitment.' },
    ],
    faqs: [
      { question: 'How much does brisket shrink when smoking?', answer: 'Expect 40-50% weight loss. A 15 lb whole packer brisket typically yields 7.5-9 lbs of finished product after trimming the fat cap, cooking, and slicing. This means your per-pound cost nearly doubles from raw to cooked.', slug: 'brisket-shrinkage' },
      { question: 'How do I price smoked meat per pound?', answer: 'Calculate your cooked-weight cost (raw meat cost ÷ yield percentage + fuel + labor + overhead), then apply a markup. If your brisket costs $42/lb all-in for 8 lbs ($336 total), you need to charge at least $25-30/lb to make a reasonable margin.', slug: 'price-per-pound' },
      { question: 'Should I count sleep time as labor for overnight smokes?', answer: 'Count your active time: loading the smoker, monitoring temps, wrapping, pulling, and resting. If you wake up twice during the night to check, add that time. Most pitmasters find a 14-hour brisket cook involves 4-6 hours of actual labor.', slug: 'overnight-labor' },
      { question: 'How do I price BBQ for catering events?', answer: 'Calculate your per-pound cooked cost, estimate servings (⅓ to ½ lb per person for a multi-meat spread), add sides and setup time, then apply your margin. A 50-person BBQ catering typically runs $15-25 per head for the operator to make a profit.', slug: 'catering-pricing' },
    ],
    ctaHeadline: 'Stop losing money\non every smoke.',
    ctaSubtext: 'Shrinkage and time are the hidden costs of BBQ. See what each cook actually costs you.',
    related: ['food-cost-calculator', 'bread-cost-calculator', 'baking-cost-calculator'],
  },

  // =========================================================================
  // 6. Bread Cost Calculator
  // =========================================================================
  {
    slug: 'bread-cost-calculator',
    keyword: 'bread cost calculator',
    title: 'Bread Cost Calculator — Price Artisan Bread | RecipePricer',
    description:
      'Free bread cost calculator for home bakers and micro bakeries. Calculate flour, yeast, labor (including fermentation time), and overhead. Find your price per loaf.',
    heroHeadline: 'Bread Cost Calculator',
    heroSubheadline:
      'Bread ingredients are dirt cheap — $1.20 for four loaves. But 20 hours of fermentation, shaping, and baking makes your true cost $13+ per loaf. See the real numbers.',
    heroCta: 'Calculate your bread costs — free',
    heroBadges: ['Free cost breakdown', 'Fermentation time included', 'Per-loaf pricing'],
    costComparison: {
      productName: 'a batch of 4 sourdough boules',
      ingredientOnly: {
        items: [
          { label: 'Bread flour (5 cups)', amount: '$2.00' },
          { label: 'Starter maintenance (flour)', amount: '$0.80' },
          { label: 'Salt', amount: '$0.10' },
          { label: 'Seeds & toppings', amount: '$1.20' },
          { label: 'Water', amount: '$0.00' },
        ],
        total: '$4.10',
      },
      trueCost: {
        ingredientTotal: '$4.10',
        laborHours: '3',
        laborCost: '$45.00',
        packaging: '$4.00',
        overhead: '$3.50',
        platformFees: '$2.00',
        total: '$58.60',
      },
      hiddenCost: '$54.50',
      hiddenCostLabel: 'hidden cost per batch — fermentation time is deceptive',
    },
    ingredientsSectionTitle: 'Bread-specific ingredients & cost drivers',
    ingredients: [
      { name: 'Bread flour', typicalCost: '$0.40–0.80/lb', costDriver: 'Cheap per batch, but quality flour (King Arthur, Central Milling) costs 2x grocery store brands' },
      { name: 'Whole grain & specialty flours', typicalCost: '$1–4/lb', costDriver: 'Rye, spelt, einkorn — adds complexity to flavor but triples flour cost' },
      { name: 'Sourdough starter maintenance', typicalCost: '$1–2/week', costDriver: 'Daily feeding uses flour; easy to overlook but adds $4-8/month in ongoing cost' },
      { name: 'Seeds & inclusions', typicalCost: '$4–10/lb', costDriver: 'Sesame, sunflower, walnuts, olives — small amounts per loaf but expensive per pound' },
      { name: 'Commercial yeast', typicalCost: '$5–8/lb', costDriver: 'Cheap per batch ($0.05-0.15) but adds up if you bake 5-6 days per week' },
      { name: 'Dutch oven / baking steel', typicalCost: '$30–250 one-time', costDriver: 'Equipment cost that should be amortized over batches — $0.10-0.50 per bake over its lifetime' },
    ],
    benchmarks: [
      { metric: 'Ingredient cost per loaf', value: '$0.50–2.00', context: 'Bread has the lowest ingredient cost of any baked good — the margin trap is in undervaluing labor' },
      { metric: 'Artisan sourdough retail price', value: '$6–14/loaf', context: 'Farmers market and bakery prices; $8-10 is the most common sweet spot' },
      { metric: 'Total time (mix to cool)', value: '18–36 hrs', context: 'Sourdough: 20-36 hrs. Yeasted: 4-8 hrs. Even "quick" bread takes longer than you think' },
      { metric: 'Active labor per batch', value: '2–4 hrs', context: 'Mixing, folding, shaping, scoring, loading oven, and cleanup — fermentation is passive but scheduling around it isn\'t' },
    ],
    tips: [
      { title: 'Separate active labor from passive fermentation', body: 'A sourdough loaf takes 24+ hours from start to finish, but only 2-3 hours of active work (mixing, folding, shaping, baking). Price your labor for the active hours, but recognize that fermentation ties up your schedule — you can\'t just ignore it.' },
      { title: 'Count your starter feeding cost', body: 'If you feed your sourdough starter daily with 100g flour, that\'s 700g/week — about $1-2/week or $50-100/year. Not huge, but it\'s a real ongoing cost that adds up. If you discard starter, count that flour as waste.' },
      { title: 'Batch efficiently to maximize margin', body: 'Bread has high fixed costs per bake session (oven preheating, cleanup, scheduling). Baking 4-6 loaves takes barely more active time than baking 2. The more loaves per session, the lower your per-loaf labor and overhead cost.' },
    ],
    faqs: [
      { question: 'Should I count fermentation time as labor?', answer: 'Count your active labor (mixing, folding, shaping, scoring, baking, cleanup), not passive fermentation time. However, recognize that bulk fermentation locks you into a schedule — you need to be available to shape the dough when it\'s ready. Most bakers find 2-3 hours of active labor per batch of 4 loaves.', slug: 'fermentation-labor' },
      { question: 'How much should I charge for a sourdough loaf?', answer: 'Research your local market. Farmers market sourdough typically sells for $6-14. If your true cost per loaf is $6-8 (ingredients + active labor + overhead), price at $10-14 for a healthy margin. Don\'t compete on price with grocery store bread — compete on quality and freshness.', slug: 'sourdough-price' },
      { question: 'Is home bread baking profitable?', answer: 'It can be, but margins are tight because ingredients are so cheap that customers undervalue bread. The key is volume (bake 6+ loaves per session to spread fixed costs) and premium positioning (specialty grains, unique flavors, sourdough culture story). Plain white bread is nearly impossible to sell profitably at home scale.', slug: 'bread-profitable' },
      { question: 'How do I price bread for a farmers market?', answer: 'Calculate your per-loaf cost including booth fee (divide by expected loaves sold), gas, and market time. A farmers market booth ($25-50/day) adds $1-2 per loaf if you sell 20-30 loaves. Factor market prep time (bagging, loading, setup, teardown) as labor.', slug: 'farmers-market' },
    ],
    ctaHeadline: 'Flour is cheap.\nYour time isn\'t.',
    ctaSubtext: 'Bread ingredients cost $1-2 per loaf — but your true cost is $6-8. See the breakdown.',
    related: ['baking-cost-calculator', 'food-cost-calculator', 'cake-cost-calculator'],
  },

  // =========================================================================
  // 7. Ice Cream Cost Calculator
  // =========================================================================
  {
    slug: 'ice-cream-cost-calculator',
    keyword: 'ice cream cost calculator',
    title: 'Ice Cream Cost Calculator — Price Homemade Ice Cream | RecipePricer',
    description:
      'Free ice cream cost calculator for artisan ice cream makers. Calculate ingredient costs (cream, eggs, mix-ins), labor, and overhead. Find your price per pint or per scoop.',
    heroHeadline: 'Ice Cream Cost Calculator',
    heroSubheadline:
      'Heavy cream, eggs, and premium mix-ins make ice cream one of the most ingredient-expensive foods to make at home. Add churning time and cold chain costs — your true cost per pint might surprise you.',
    heroCta: 'Calculate your ice cream costs — free',
    heroBadges: ['Free cost breakdown', 'Per-pint & per-scoop pricing', 'Mix-in cost tracking'],
    costComparison: {
      productName: 'a batch of salted caramel ice cream (8 pints)',
      ingredientOnly: {
        items: [
          { label: 'Heavy cream (1 quart)', amount: '$5.50' },
          { label: 'Whole milk (2 cups)', amount: '$1.20' },
          { label: 'Egg yolks (6)', amount: '$1.50' },
          { label: 'Sugar & salt', amount: '$0.80' },
          { label: 'Caramel sauce (homemade)', amount: '$4.00' },
        ],
        total: '$13.00',
      },
      trueCost: {
        ingredientTotal: '$13.00',
        laborHours: '3',
        laborCost: '$45.00',
        packaging: '$12.00',
        overhead: '$8.00',
        platformFees: '$3.00',
        total: '$81.00',
      },
      hiddenCost: '$68.00',
      hiddenCostLabel: 'hidden cost per batch — cream is expensive and packaging adds up fast',
    },
    ingredientsSectionTitle: 'Ice cream-specific ingredients & cost drivers',
    ingredients: [
      { name: 'Heavy cream', typicalCost: '$4–6/quart', costDriver: 'The single biggest ingredient cost; a batch uses 1-2 quarts and there\'s no cheap substitute' },
      { name: 'Egg yolks', typicalCost: '$0.25–0.50/each', costDriver: 'Custard-based ice cream uses 4-8 yolks per batch; wasted whites add to cost if not used' },
      { name: 'Mix-ins (nuts, chocolate, fruit)', typicalCost: '$3–12/lb', costDriver: 'Premium mix-ins like pistachios or high-end chocolate can double your per-pint cost' },
      { name: 'Vanilla (extract or beans)', typicalCost: '$3–5/oz (extract)', costDriver: 'Real vanilla beans cost $3-8 EACH; extract is cheaper but still $1-2 per batch' },
      { name: 'Pint containers & lids', typicalCost: '$0.50–1.50/each', costDriver: 'Quality containers with tamper-evident lids cost $1+ each; you need them for every pint' },
      { name: 'Dry ice / insulated packaging', typicalCost: '$5–15/shipment', costDriver: 'Shipping or market transport requires cold chain — dry ice, coolers, and insulated bags' },
    ],
    benchmarks: [
      { metric: 'Ingredient cost per pint', value: '$1.50–3.00', context: 'Higher than most baked goods due to dairy; mix-in flavors cost more than base flavors' },
      { metric: 'Artisan ice cream retail (pint)', value: '$8–16', context: 'Farmers market and online pricing; $10-12 is common for premium small-batch' },
      { metric: 'Per-scoop pricing', value: '$3–6', context: 'A pint yields ~4 scoops; price per scoop for events and pop-ups' },
      { metric: 'Overrun (air incorporation)', value: '20–40%', context: 'Home machines produce denser ice cream (less overrun) than commercial — fewer scoops per batch' },
    ],
    tips: [
      { title: 'Account for egg white waste', body: 'Custard-based ice cream uses yolks only. If you\'re not using the whites (for meringues, angel food cake, cocktails), those eggs cost twice what you think. Consider recipes that use whole eggs, or sell the whites to other bakers.' },
      { title: 'Price mix-in flavors higher', body: 'A vanilla base costs $1.50/pint in ingredients. A pistachio or cookie dough flavor costs $3-4/pint. Your menu should reflect this — charge $2-4 more for premium flavors instead of averaging all flavors to one price.' },
      { title: 'Don\'t forget cold chain costs', body: 'Ice cream must stay frozen from churning to customer. Freezer electricity, dry ice for farmers markets ($5-10/day), and insulated containers are real costs. Budget $1-2 per pint for cold chain overhead.' },
    ],
    faqs: [
      { question: 'How much does it cost to make a pint of ice cream?', answer: 'Ingredient cost ranges from $1.50 (vanilla base) to $4+ (premium mix-ins like pistachio or real cookie dough). Add labor ($2-5/pint), packaging ($0.50-1.50/pint), and overhead ($0.50-1/pint). Total true cost: $5-10/pint depending on flavor and scale.', slug: 'cost-per-pint' },
      { question: 'How should I price homemade ice cream?', answer: 'Aim for 25-35% cost ratio. If a pint costs $8 to make (total cost), price at $16-24. Most artisan ice cream sells for $8-16/pint; you may need to increase batch size or reduce costs to hit your target margin at market-competitive prices.', slug: 'pricing-strategy' },
      { question: 'Is homemade ice cream profitable?', answer: 'It can be, but margins are tighter than baked goods due to high ingredient costs and cold chain requirements. The key is premium positioning (unique flavors, local ingredients, story), volume (8+ pints per churn), and smart flavor mix (high-margin vanilla alongside premium flavors).', slug: 'profitability' },
      { question: 'How do I sell ice cream at farmers markets?', answer: 'You\'ll need: a commercial kitchen or cottage food permit (varies by state), a chest freezer or dry ice setup ($5-15 per market day), proper containers with labels, and liability insurance. Factor all of these into your per-pint overhead before setting your price.', slug: 'farmers-market' },
    ],
    ctaHeadline: 'Cream is expensive.\nKnow your real cost per pint.',
    ctaSubtext: 'Heavy cream, mix-ins, and cold chain add up fast. See what each pint actually costs you.',
    related: ['food-cost-calculator', 'baking-cost-calculator', 'cookie-pricing-calculator'],
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function getNicheBySlug(slug: string): NicheLanding | undefined {
  return NICHE_LANDINGS.find((n) => n.slug === slug);
}

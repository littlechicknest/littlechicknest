-- Sample catalogue so the client can preview the full shop. Images live in public/products.
-- Remove them all from Admin > Products > "Delete sample products" once real products are in.
insert into public.products (source, title, category, manual_price, is_featured, description, variants, created_at, is_sample)
select 'manual', t, c, p, f, d, v, at, true
from (values
('Everyday Crew Sweatshirt', 'Men', 46, true, 'A soft, mid-weight crew you will reach for every day. A small embroidered chick sits on the chest, clean and understated.

- 80% organic cotton, 20% recycled polyester, 280 gsm
- Relaxed fit with dropped shoulders and ribbed cuffs
- Embroidered logo
- Machine wash cold, inside out', '[{"color":"Beige","hex":"#d9c8a9","sizes":["S","M","L","XL","2XL"],"images":["products/sweat-beige.webp"]},{"color":"Forest Olive","hex":"#4c5334","sizes":["S","M","L","XL","2XL"],"images":["products/sweat-olive.webp"]}]'::jsonb, now() - interval '0 minutes'),
('Forest Olive Hoodie', 'Men', 52, true, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Forest Olive","hex":"#4c5334","sizes":["S","M","L","XL","2XL"],"images":["products/hoodie-forest.webp"]},{"color":"Olive Green","hex":"#6b7048","sizes":["S","M","L","XL","2XL"],"images":["products/hoodie-olive.webp"]},{"color":"Charcoal","hex":"#46474a","sizes":["S","M","L","XL","2XL"],"images":["products/hoodie-charcoal.webp"]}]'::jsonb, now() - interval '1 minutes'),
('Classic Chick Tee', 'Men', 28, false, 'Our everyday tee in a heavyweight organic cotton that softens with every wash.

- 100% organic ring-spun cotton, 180 gsm
- Classic regular fit, crew neck
- Printed with eco-friendly water-based inks
- Machine wash at 30°C', '[{"color":"Cream","hex":"#f1ead9","sizes":["S","M","L","XL","2XL"],"images":["products/tee-cream.webp","products/tee-cream-detail.webp"]}]'::jsonb, now() - interval '2 minutes'),
('Big Chick Back-Print Tee', 'Men', 32, false, 'Our classic tee with a large Little Chick Nest print across the back and a clean front.

- 100% organic ring-spun cotton, 180 gsm
- Regular fit, crew neck
- Large back print in olive
- Machine wash at 30°C', '[{"color":"Cream","hex":"#f1ead9","sizes":["S","M","L","XL","2XL"],"images":["products/tee-back.webp","products/tee-cream.webp"]}]'::jsonb, now() - interval '3 minutes'),
('Olive Field Cap', 'Men', 26, false, 'A six-panel cotton twill cap with a curved peak and a brass buckle at the back. The logo is embroidered for a raised, tidy finish.

- 100% cotton twill, unstructured
- One size, adjustable strap fits most adults
- Embroidered front logo', '[{"color":"Olive Green","hex":"#6b7048","sizes":[],"images":["products/cap-olive-cream.webp","products/man-olive-cap.webp"]}]'::jsonb, now() - interval '4 minutes'),
('Weekend Dad Cap', 'Men', 26, false, 'A six-panel cotton twill cap with a curved peak and a brass buckle at the back. The logo is embroidered for a raised, tidy finish.

- 100% cotton twill, unstructured
- One size, adjustable strap fits most adults
- Embroidered front logo', '[{"color":"Cream","hex":"#f1ead9","sizes":[],"images":["products/cap-cream-olive.webp","products/cap-back.webp"]}]'::jsonb, now() - interval '5 minutes'),
('Little Chick Embroidered Hoodie', 'Women', 54, true, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Beige","hex":"#d9c8a9","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-beige.webp"]},{"color":"Oat Milk","hex":"#ece4d3","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-oat.webp"]},{"color":"Sage Green","hex":"#b4c0a8","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-sage.webp"]},{"color":"Honey","hex":"#d39b2b","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-honey.webp"]},{"color":"Terracotta","hex":"#b65a3b","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-terracotta.webp"]},{"color":"Dusty Pink","hex":"#e2bfb1","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-pink.webp"]}]'::jsonb, now() - interval '6 minutes'),
('Oat Milk Lounge Hoodie', 'Women', 52, false, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Oat Milk","hex":"#ece4d3","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-oat.webp"]}]'::jsonb, now() - interval '7 minutes'),
('Sage Garden Hoodie', 'Women', 52, true, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Sage Green","hex":"#b4c0a8","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-sage.webp"]}]'::jsonb, now() - interval '8 minutes'),
('Honey Glow Hoodie', 'Women', 52, false, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Honey","hex":"#d39b2b","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-honey.webp"]}]'::jsonb, now() - interval '9 minutes'),
('Back-Embroidered Sweatshirt', 'Women', 48, false, 'A cosy crew with a large embroidered logo across the back, for a little surprise as you walk away.

- 80% organic cotton, 20% recycled polyester, 280 gsm
- Relaxed fit
- Large back embroidery in mustard thread
- Machine wash cold, inside out', '[{"color":"Beige","hex":"#d9c8a9","sizes":["XS","S","M","L","XL","2XL"],"images":["products/sweat-back.webp","products/sweat-beige.webp"]}]'::jsonb, now() - interval '10 minutes'),
('Terracotta Sunday Hoodie', 'Women', 52, false, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Terracotta","hex":"#b65a3b","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-terracotta.webp"]}]'::jsonb, now() - interval '11 minutes'),
('Dusty Pink Hoodie', 'Women', 52, false, 'Our heavyweight hoodie, made for slow mornings and chilly evenings at the coop. The Little Chick Nest logo is embroidered on the chest in olive and mustard thread, so it stays crisp wash after wash.

- 80% ring-spun cotton, 20% recycled polyester, 300 gsm brushed fleece
- Relaxed unisex fit with a lined hood and kangaroo pocket
- Embroidered chest logo
- Machine wash cold, inside out. Do not tumble dry', '[{"color":"Dusty Pink","hex":"#e2bfb1","sizes":["XS","S","M","L","XL","2XL"],"images":["products/hoodie-pink.webp"]}]'::jsonb, now() - interval '12 minutes'),
('Kids'' Cap & Socks Gift Set', 'Kids', 34, true, 'A ready-to-give set for little chick fans: an embroidered cap and a pair of matching cosy socks, packed in a kraft gift box.

- Kids'' cap with adjustable strap
- Soft cotton-blend socks
- Arrives gift boxed', '[{"color":"Cream","hex":"#f1ead9","sizes":["3-5Y","6-8Y","9-12Y"],"images":["products/set-classic.webp"]},{"color":"Olive Green","hex":"#6b7048","sizes":["3-5Y","6-8Y","9-12Y"],"images":["products/set-green.webp"]}]'::jsonb, now() - interval '13 minutes'),
('Kids'' Beanie & Socks Winter Set', 'Kids', 38, false, 'Keep little ears and toes warm. A cable-knit pom-pom beanie with a woven chick label, plus matching socks, all in a kraft gift box.

- Cable-knit beanie with faux-fur pom-pom
- Soft cotton-blend socks
- Arrives gift boxed', '[{"color":"Beige","hex":"#d9c8a9","sizes":["3-5Y","6-8Y","9-12Y"],"images":["products/set-premium.webp"]}]'::jsonb, now() - interval '14 minutes'),
('Kids'' Little Chick Tee', 'Kids', 22, true, 'Soft, durable and made for playing outside. Printed with our little chick on the chest.

- 100% organic cotton
- Regular kids'' fit
- Machine wash at 30°C', '[{"color":"Cream","hex":"#f1ead9","sizes":["3-4Y","5-6Y","7-8Y","9-10Y","11-12Y"],"images":["products/tee-cream-detail.webp","products/tee-cream.webp"]}]'::jsonb, now() - interval '15 minutes'),
('Kids'' Cosy Scarf', 'Kids', 24, false, 'A soft, fringed scarf sized for smaller shoulders, with a tiny embroidered chick at the end.

- Brushed wool-feel acrylic, 140 × 22 cm
- Fringed ends
- Hand wash cold', '[{"color":"Mustard","hex":"#c99a2e","sizes":[],"images":["products/scarf-mustard.webp"]},{"color":"Cream","hex":"#f1ead9","sizes":[],"images":["products/scarf-cream.webp"]}]'::jsonb, now() - interval '16 minutes'),
('Kids'' Embroidered Cap', 'Kids', 20, false, 'A smaller-fit cotton cap with our chick embroidered on the front.

- 100% cotton twill
- Kids'' size, adjustable strap
- Embroidered logo', '[{"color":"Cream","hex":"#f1ead9","sizes":[],"images":["products/cap-studio.webp"]}]'::jsonb, now() - interval '17 minutes'),
('Kids'' Crew Sweatshirt', 'Kids', 32, false, 'A soft crew for school runs and muddy walks, with a small embroidered chick on the chest.

- 80% organic cotton, 20% recycled polyester
- Ribbed cuffs and hem
- Machine wash cold', '[{"color":"Forest Olive","hex":"#4c5334","sizes":["3-4Y","5-6Y","7-8Y","9-10Y","11-12Y"],"images":["products/sweat-olive.webp"]},{"color":"Beige","hex":"#d9c8a9","sizes":["3-4Y","5-6Y","7-8Y","9-10Y","11-12Y"],"images":["products/sweat-beige.webp"]}]'::jsonb, now() - interval '18 minutes'),
('Signature Embroidered Cap', 'Accessories', 28, true, 'A six-panel cotton twill cap with a curved peak and a brass buckle at the back. The logo is embroidered for a raised, tidy finish.

- 100% cotton twill, unstructured
- One size, adjustable strap fits most adults
- Embroidered front logo', '[{"color":"Cream","hex":"#f1ead9","sizes":[],"images":["products/cap-signature.webp","products/woman-cap.webp"]},{"color":"Beige","hex":"#d9c8a9","sizes":[],"images":["products/cap-beige-mustard.webp"]}]'::jsonb, now() - interval '19 minutes'),
('Olive Stoneware Mug', 'Accessories', 20, true, 'A matte olive stoneware mug with our logo in cream and mustard. Made to be held with both hands.

- 12 oz (350 ml) stoneware, matte glaze
- Dishwasher and microwave safe
- Printed with long-lasting ceramic inks', '[{"color":"Olive Green","hex":"#6b7048","sizes":[],"images":["products/mug-olive.webp"]}]'::jsonb, now() - interval '20 minutes'),
('Cream Logo Mug', 'Accessories', 18, false, 'A sturdy ceramic mug for your morning coffee while you watch the chicks wake up.

- 11 oz (325 ml) ceramic
- Dishwasher and microwave safe
- Printed with long-lasting ceramic inks', '[{"color":"Cream","hex":"#f1ead9","sizes":[],"images":["products/mug-cream.webp"]}]'::jsonb, now() - interval '21 minutes'),
('Speckled Honey Mug', 'Accessories', 20, false, 'A speckled stoneware mug with our logo in warm mustard.

- 12 oz (350 ml) speckled stoneware
- Dishwasher and microwave safe', '[{"color":"Beige","hex":"#d9c8a9","sizes":[],"images":["products/mug-speckled.webp"]}]'::jsonb, now() - interval '22 minutes'),
('Little Chick Gift Box', 'Accessories', 68, true, 'Our favourite things in one box: an embroidered cap, a classic tee and a cream logo mug, nested in a kraft box. The easiest gift for any chick lover.

- Signature cap (one size)
- Classic Chick Tee (choose size)
- Cream Logo Mug
- Kraft gift box', '[{"color":"Cream","hex":"#f1ead9","sizes":["S","M","L","XL","2XL"],"images":["products/gift-box.webp"]}]'::jsonb, now() - interval '23 minutes'),
('Wool-Blend Logo Scarf', 'Accessories', 34, false, 'A generously long fringed scarf with a small embroidered chick at each end.

- Soft wool-feel blend, 180 × 30 cm
- Fringed ends
- Hand wash cold', '[{"color":"Olive Green","hex":"#6b7048","sizes":[],"images":["products/scarf-olive.webp"]},{"color":"Beige","hex":"#d9c8a9","sizes":[],"images":["products/scarf-beige.webp"]}]'::jsonb, now() - interval '24 minutes')
) as s(t, c, p, f, d, v, at)
where not exists (select 1 from public.products where is_sample);

-- Seed data: 10 destinations, 50 places, a demo user, 5 published guides and one sample trip.
-- Safe to run more than once.
--
-- Demo login: demo@planner.dev / password123

-- ---------------------------------------------------------------------------
-- Demo user (profile is created by the on_auth_user_created trigger)
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@planner.dev',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "wanderer", "full_name": "Demo Wanderer"}',
  now(),
  now(),
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  'd0000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "email": "demo@planner.dev", "email_verified": true}',
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Destinations
-- ---------------------------------------------------------------------------

insert into public.destinations (name, slug, country, region, cover_url, description, lat, lng, popularity)
values
  ('Tokyo', 'tokyo', 'Japan', 'Asia',
   'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf',
   'Neon-lit streets, quiet temples, and the best food scene on the planet.',
   35.6762, 139.6503, 980),
  ('Paris', 'paris', 'France', 'Europe',
   'https://images.unsplash.com/photo-1502602898657-3e91760cbb34',
   'Café terraces, world-class museums, and walks along the Seine.',
   48.8566, 2.3522, 960),
  ('New York City', 'new-york-city', 'United States', 'North America',
   'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9',
   'Five boroughs of skyline views, delis, Broadway, and Central Park.',
   40.7128, -74.0060, 940),
  ('Rome', 'rome', 'Italy', 'Europe',
   'https://images.unsplash.com/photo-1552832230-c0197dd311b5',
   'Ancient ruins around every corner and pasta worth the trip alone.',
   41.9028, 12.4964, 900),
  ('Barcelona', 'barcelona', 'Spain', 'Europe',
   'https://images.unsplash.com/photo-1583422409516-2895a77efded',
   'Gaudí architecture, tapas bars, and beaches inside the city.',
   41.3874, 2.1686, 880),
  ('Bangkok', 'bangkok', 'Thailand', 'Asia',
   'https://images.unsplash.com/photo-1508009603885-50cf7c579365',
   'Golden temples, river ferries, and street food at every hour.',
   13.7563, 100.5018, 860),
  ('London', 'london', 'United Kingdom', 'Europe',
   'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad',
   'Free museums, historic pubs, and markets in every neighbourhood.',
   51.5072, -0.1276, 850),
  ('Bali', 'bali', 'Indonesia', 'Asia',
   'https://images.unsplash.com/photo-1537996194471-e657df975ab4',
   'Rice terraces, cliffside temples, and surf breaks.',
   -8.4095, 115.1889, 820),
  ('Seoul', 'seoul', 'South Korea', 'Asia',
   'https://images.unsplash.com/photo-1538485399081-7191377e8241',
   'Palaces next to skyscrapers, late-night markets, and café culture.',
   37.5665, 126.9780, 800),
  ('Lisbon', 'lisbon', 'Portugal', 'Europe',
   'https://images.unsplash.com/photo-1585208798174-6cedd86e019a',
   'Hilly streets, yellow trams, custard tarts, and Atlantic sunsets.',
   38.7223, -9.1393, 780)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Places (external_id keeps the seed idempotent)
-- ---------------------------------------------------------------------------

insert into public.places (destination_id, name, category, description, address, lat, lng, rating, external_id)
select d.id, v.name, v.category::public.place_category, v.description, v.address, v.lat, v.lng, v.rating, v.external_id
from (
  values
    -- Tokyo
    ('tokyo', 'Senso-ji', 'attraction', 'Tokyo''s oldest temple, reached through the Nakamise shopping street.', '2-3-1 Asakusa, Taito City', 35.7148, 139.7967, 4.6, 'seed:tokyo-sensoji'),
    ('tokyo', 'Shibuya Crossing', 'attraction', 'The world''s busiest pedestrian scramble.', '2-2-1 Dogenzaka, Shibuya City', 35.6595, 139.7005, 4.5, 'seed:tokyo-shibuya-crossing'),
    ('tokyo', 'Ichiran Shibuya', 'restaurant', 'Tonkotsu ramen eaten in solo booths.', '1-22-7 Jinnan, Shibuya City', 35.6614, 139.7010, 4.4, 'seed:tokyo-ichiran'),
    ('tokyo', 'Fuglen Tokyo', 'cafe', 'Norwegian coffee by day, cocktails by night.', '1-16-11 Tomigaya, Shibuya City', 35.6680, 139.6930, 4.5, 'seed:tokyo-fuglen'),
    ('tokyo', 'Park Hyatt Tokyo', 'hotel', 'Skyline views from the 52nd floor of Shinjuku Park Tower.', '3-7-1-2 Nishishinjuku, Shinjuku City', 35.6856, 139.6907, 4.7, 'seed:tokyo-park-hyatt'),
    -- Paris
    ('paris', 'Eiffel Tower', 'attraction', 'Iron icon with views over the whole city.', 'Champ de Mars, 5 Av. Anatole France', 48.8584, 2.2945, 4.7, 'seed:paris-eiffel'),
    ('paris', 'Louvre Museum', 'attraction', 'The world''s most-visited art museum.', 'Rue de Rivoli, 75001', 48.8606, 2.3376, 4.7, 'seed:paris-louvre'),
    ('paris', 'Le Comptoir du Relais', 'restaurant', 'Classic Saint-Germain bistro.', '9 Carrefour de l''Odéon, 75006', 48.8521, 2.3389, 4.4, 'seed:paris-comptoir'),
    ('paris', 'Café de Flore', 'cafe', 'Left Bank café made famous by writers and philosophers.', '172 Bd Saint-Germain, 75006', 48.8541, 2.3326, 4.2, 'seed:paris-flore'),
    ('paris', 'Le Syndicat', 'nightlife', 'Cocktail bar using only French spirits.', '51 Rue du Faubourg Saint-Denis, 75010', 48.8710, 2.3540, 4.6, 'seed:paris-syndicat'),
    -- New York City
    ('new-york-city', 'Central Park', 'attraction', '843 acres of lawns, lakes, and paths in Manhattan.', 'New York, NY', 40.7829, -73.9654, 4.8, 'seed:nyc-central-park'),
    ('new-york-city', 'The Metropolitan Museum of Art', 'attraction', '5,000 years of art under one roof.', '1000 5th Ave, New York, NY', 40.7794, -73.9632, 4.8, 'seed:nyc-met'),
    ('new-york-city', 'Katz''s Delicatessen', 'restaurant', 'Pastrami on rye since 1888.', '205 E Houston St, New York, NY', 40.7223, -73.9874, 4.5, 'seed:nyc-katz'),
    ('new-york-city', 'Shake Shack Madison Square Park', 'fast_food', 'The original burger kiosk in the park.', 'Madison Ave & E 23rd St, New York, NY', 40.7414, -73.9882, 4.4, 'seed:nyc-shake-shack'),
    ('new-york-city', 'The Standard, High Line', 'hotel', 'Glass tower straddling the High Line.', '848 Washington St, New York, NY', 40.7407, -74.0080, 4.4, 'seed:nyc-standard'),
    -- Rome
    ('rome', 'Colosseum', 'attraction', 'The largest amphitheatre ever built.', 'Piazza del Colosseo, 1', 41.8902, 12.4922, 4.8, 'seed:rome-colosseum'),
    ('rome', 'Pantheon', 'attraction', '2,000-year-old temple with an open oculus.', 'Piazza della Rotonda', 41.8986, 12.4769, 4.8, 'seed:rome-pantheon'),
    ('rome', 'Roscioli Salumeria con Cucina', 'restaurant', 'Deli-restaurant famous for carbonara.', 'Via dei Giubbonari, 21', 41.8940, 12.4733, 4.6, 'seed:rome-roscioli'),
    ('rome', 'Sant''Eustachio Il Caffè', 'cafe', 'Wood-roasted espresso near the Pantheon.', 'Piazza di S. Eustachio, 82', 41.8983, 12.4752, 4.5, 'seed:rome-santeustachio'),
    ('rome', 'Hotel Artemide', 'hotel', 'Art nouveau hotel on Via Nazionale.', 'Via Nazionale, 22', 41.9008, 12.4933, 4.7, 'seed:rome-artemide'),
    -- Barcelona
    ('barcelona', 'Sagrada Família', 'attraction', 'Gaudí''s unfinished basilica.', 'C/ de Mallorca, 401', 41.4036, 2.1744, 4.8, 'seed:bcn-sagrada'),
    ('barcelona', 'Park Güell', 'attraction', 'Mosaic terraces overlooking the city.', '08024 Barcelona', 41.4145, 2.1527, 4.5, 'seed:bcn-park-guell'),
    ('barcelona', 'Cervecería Catalana', 'restaurant', 'Busy tapas bar in Eixample.', 'C/ de Mallorca, 236', 41.3923, 2.1617, 4.5, 'seed:bcn-cerveceria'),
    ('barcelona', 'Satan''s Coffee Corner', 'cafe', 'Specialty coffee in the Gothic Quarter.', 'C/ de l''Arc de Sant Ramon del Call, 11', 41.3833, 2.1767, 4.5, 'seed:bcn-satans'),
    ('barcelona', 'Paradiso', 'nightlife', 'Speakeasy hidden behind a pastrami fridge.', 'C/ de Rera Palau, 4', 41.3848, 2.1830, 4.6, 'seed:bcn-paradiso'),
    -- Bangkok
    ('bangkok', 'The Grand Palace', 'attraction', 'Former royal residence and home of the Emerald Buddha.', 'Na Phra Lan Rd, Phra Nakhon', 13.7500, 100.4913, 4.6, 'seed:bkk-grand-palace'),
    ('bangkok', 'Wat Arun', 'attraction', 'Temple of Dawn on the Chao Phraya river.', '158 Thanon Wang Doem, Bangkok Yai', 13.7437, 100.4889, 4.7, 'seed:bkk-wat-arun'),
    ('bangkok', 'Thipsamai Pad Thai', 'restaurant', 'Pad thai wrapped in egg since 1966.', '313 Maha Chai Rd, Samran Rat', 13.7527, 100.5047, 4.3, 'seed:bkk-thipsamai'),
    ('bangkok', 'Sky Bar at Lebua', 'nightlife', 'Rooftop bar 63 floors up.', '1055 Silom Rd, Bang Rak', 13.7216, 100.5170, 4.4, 'seed:bkk-sky-bar'),
    ('bangkok', 'Mandarin Oriental Bangkok', 'hotel', 'Historic riverside hotel.', '48 Oriental Ave, Bang Rak', 13.7239, 100.5143, 4.8, 'seed:bkk-mandarin'),
    -- London
    ('london', 'British Museum', 'attraction', 'Free museum of world history and culture.', 'Great Russell St, London WC1B 3DG', 51.5194, -0.1270, 4.8, 'seed:ldn-british-museum'),
    ('london', 'Tower of London', 'attraction', 'Medieval fortress and the Crown Jewels.', 'London EC3N 4AB', 51.5081, -0.0759, 4.6, 'seed:ldn-tower'),
    ('london', 'Dishoom Covent Garden', 'restaurant', 'Bombay café cooking; get the bacon naan.', '12 Upper St Martin''s Ln, London WC2H 9FB', 51.5124, -0.1269, 4.7, 'seed:ldn-dishoom'),
    ('london', 'Monmouth Coffee Borough', 'cafe', 'Coffee institution by Borough Market.', '2 Park St, London SE1 9AB', 51.5055, -0.0911, 4.6, 'seed:ldn-monmouth'),
    ('london', 'Honest Burgers Soho', 'fast_food', 'Burgers with rosemary-salted chips.', '4a Meard St, London W1F 0EF', 51.5137, -0.1353, 4.5, 'seed:ldn-honest'),
    -- Bali
    ('bali', 'Tegallalang Rice Terrace', 'attraction', 'Sweeping terraced rice paddies north of Ubud.', 'Tegallalang, Gianyar', -8.4312, 115.2793, 4.4, 'seed:bali-tegallalang'),
    ('bali', 'Uluwatu Temple', 'attraction', 'Clifftop temple with sunset kecak dance.', 'Pecatu, South Kuta', -8.8291, 115.0849, 4.6, 'seed:bali-uluwatu'),
    ('bali', 'Warung Babi Guling Ibu Oka', 'restaurant', 'Famous Balinese roast suckling pig.', 'Jl. Tegal Sari No.2, Ubud', -8.5068, 115.2625, 4.3, 'seed:bali-ibu-oka'),
    ('bali', 'Seniman Coffee Studio', 'cafe', 'Roastery and café in central Ubud.', 'Jl. Sriwedari No.5, Ubud', -8.5065, 115.2601, 4.6, 'seed:bali-seniman'),
    ('bali', 'Potato Head Beach Club', 'nightlife', 'Beach club with pools and DJ sets.', 'Jl. Petitenget No.51B, Seminyak', -8.6795, 115.1527, 4.5, 'seed:bali-potato-head'),
    -- Seoul
    ('seoul', 'Gyeongbokgung Palace', 'attraction', 'The main royal palace of the Joseon dynasty.', '161 Sajik-ro, Jongno-gu', 37.5796, 126.9770, 4.6, 'seed:seoul-gyeongbokgung'),
    ('seoul', 'Bukchon Hanok Village', 'attraction', 'Lanes of traditional hanok houses.', '37 Gyedong-gil, Jongno-gu', 37.5826, 126.9830, 4.4, 'seed:seoul-bukchon'),
    ('seoul', 'Gwangjang Market', 'restaurant', 'Street-food market famous for bindaetteok.', '88 Changgyeonggung-ro, Jongno-gu', 37.5700, 126.9996, 4.5, 'seed:seoul-gwangjang'),
    ('seoul', 'Anthracite Coffee Hannam', 'cafe', 'Roastery in a converted building in Hannam-dong.', '240 Itaewon-ro, Yongsan-gu', 37.5347, 127.0006, 4.5, 'seed:seoul-anthracite'),
    ('seoul', 'Signiel Seoul', 'hotel', 'Hotel on the top floors of Lotte World Tower.', '300 Olympic-ro, Songpa-gu', 37.5126, 127.1025, 4.7, 'seed:seoul-signiel'),
    -- Lisbon
    ('lisbon', 'Belém Tower', 'attraction', '16th-century fortress on the Tagus.', 'Av. Brasília, 1400-038 Lisboa', 38.6916, -9.2160, 4.6, 'seed:lis-belem-tower'),
    ('lisbon', 'Jerónimos Monastery', 'attraction', 'Manueline monastery and UNESCO site.', 'Praça do Império, 1400-206 Lisboa', 38.6979, -9.2068, 4.7, 'seed:lis-jeronimos'),
    ('lisbon', 'Time Out Market Lisboa', 'restaurant', 'Food hall with the city''s best chefs.', 'Av. 24 de Julho 49, 1200-479 Lisboa', 38.7069, -9.1459, 4.5, 'seed:lis-time-out'),
    ('lisbon', 'Pastéis de Belém', 'cafe', 'The original pastel de nata, since 1837.', 'R. de Belém 84 92, 1300-085 Lisboa', 38.6975, -9.2032, 4.7, 'seed:lis-pasteis'),
    ('lisbon', 'Pink Street', 'nightlife', 'Bar-lined street in Cais do Sodré.', 'R. Nova do Carvalho, 1200-292 Lisboa', 38.7072, -9.1440, 4.3, 'seed:lis-pink-street')
) as v(slug, name, category, description, address, lat, lng, rating, external_id)
join public.destinations d on d.slug = v.slug
on conflict (external_id) do nothing;

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------

insert into public.guides (id, author_id, destination_id, title, intro, cover_url, tags, status)
select v.id::uuid, 'd0000000-0000-4000-8000-000000000001', d.id, v.title, v.intro, v.cover_url, v.tags::text[], 'published'
from (
  values
    ('a0000000-0000-4000-8000-000000000001', 'tokyo', '48 hours in Tokyo',
     'Temples in the morning, ramen at lunch, and the city lights after dark.',
     'https://images.unsplash.com/photo-1517154421773-0529f29ea451', '{weekend,food,first-timer}'),
    ('a0000000-0000-4000-8000-000000000002', 'paris', 'A slow Paris weekend',
     'Skip the queues: long lunches, Left Bank cafés, and one great cocktail bar.',
     'https://images.unsplash.com/photo-1502602898657-3e91760cbb34', '{cafes,food,weekend}'),
    ('a0000000-0000-4000-8000-000000000003', 'rome', 'First-timer''s Rome',
     'The ancient highlights plus where to eat between them.',
     'https://images.unsplash.com/photo-1552832230-c0197dd311b5', '{history,first-timer}'),
    ('a0000000-0000-4000-8000-000000000004', 'barcelona', 'Barcelona in a weekend',
     'Gaudí, tapas, and a speakeasy to finish the night.',
     'https://images.unsplash.com/photo-1583422409516-2895a77efded', '{architecture,nightlife}'),
    ('a0000000-0000-4000-8000-000000000005', 'seoul', 'Seoul old and new',
     'Joseon palaces in the morning, market food and coffee in the afternoon.',
     'https://images.unsplash.com/photo-1538485399081-7191377e8241', '{culture,food}')
) as v(id, slug, title, intro, cover_url, tags)
join public.destinations d on d.slug = v.slug
on conflict (id) do nothing;

insert into public.guide_sections (id, guide_id, title, position)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Must-see sights', 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Eat and drink', 2),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'Cafés and bistros', 1),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'After dark', 2),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', 'Ancient Rome', 1),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'Where to eat', 2),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', 'Gaudí', 1),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000004', 'Tapas and drinks', 2),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005', 'Palaces and hanoks', 1),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000005', 'Markets and coffee', 2)
on conflict (id) do nothing;

insert into public.guide_places (section_id, place_id, position, note)
select v.section_id::uuid, p.id, v.position, v.note
from (
  values
    ('b0000000-0000-4000-8000-000000000001', 'seed:tokyo-sensoji', 1, 'Go before 8am to have it nearly to yourself.'),
    ('b0000000-0000-4000-8000-000000000001', 'seed:tokyo-shibuya-crossing', 2, 'Watch from the Starbucks above, then walk it.'),
    ('b0000000-0000-4000-8000-000000000002', 'seed:tokyo-ichiran', 1, 'Order extra firm noodles and the spicy sauce.'),
    ('b0000000-0000-4000-8000-000000000002', 'seed:tokyo-fuglen', 2, 'Great flat white; switches to cocktails at night.'),
    ('b0000000-0000-4000-8000-000000000003', 'seed:paris-flore', 1, 'Touristy but worth one hot chocolate on the terrace.'),
    ('b0000000-0000-4000-8000-000000000003', 'seed:paris-comptoir', 2, 'Book dinner ahead; lunch is walk-in only.'),
    ('b0000000-0000-4000-8000-000000000004', 'seed:paris-syndicat', 1, 'All-French spirits. Ask for something off-menu.'),
    ('b0000000-0000-4000-8000-000000000005', 'seed:rome-colosseum', 1, 'Buy the combined Forum ticket online.'),
    ('b0000000-0000-4000-8000-000000000005', 'seed:rome-pantheon', 2, 'Free to look in from the portico; small fee inside.'),
    ('b0000000-0000-4000-8000-000000000006', 'seed:rome-roscioli', 1, 'The carbonara is the order.'),
    ('b0000000-0000-4000-8000-000000000006', 'seed:rome-santeustachio', 2, 'Ask for it amaro (unsweetened) if you prefer.'),
    ('b0000000-0000-4000-8000-000000000007', 'seed:bcn-sagrada', 1, 'Book the tower tickets; morning light is best inside.'),
    ('b0000000-0000-4000-8000-000000000007', 'seed:bcn-park-guell', 2, 'Timed entry for the monumental zone.'),
    ('b0000000-0000-4000-8000-000000000008', 'seed:bcn-cerveceria', 1, 'Expect a wait; sit at the bar if you can.'),
    ('b0000000-0000-4000-8000-000000000008', 'seed:bcn-paradiso', 2, 'Enter through the fridge door.'),
    ('b0000000-0000-4000-8000-000000000009', 'seed:seoul-gyeongbokgung', 1, 'Free entry if you wear a hanbok.'),
    ('b0000000-0000-4000-8000-000000000009', 'seed:seoul-bukchon', 2, 'It''s a residential area, so keep it quiet.'),
    ('b0000000-0000-4000-8000-000000000010', 'seed:seoul-gwangjang', 1, 'Mung bean pancakes and mayak gimbap.'),
    ('b0000000-0000-4000-8000-000000000010', 'seed:seoul-anthracite', 2, 'Sit upstairs.')
) as v(section_id, external_id, position, note)
join public.places p on p.external_id = v.external_id
where not exists (
  select 1 from public.guide_places gp
  where gp.section_id = v.section_id::uuid and gp.place_id = p.id
);

insert into public.guide_likes (guide_id, user_id)
values
  ('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sample trip for the demo user
-- ---------------------------------------------------------------------------

insert into public.trips (id, owner_id, destination_id, name, start_date, end_date, cover_url)
select
  'c0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  d.id,
  'Spring in Tokyo',
  date '2027-04-02',
  date '2027-04-06',
  d.cover_url
from public.destinations d
where d.slug = 'tokyo'
on conflict (id) do nothing;

insert into public.trip_blocks (id, trip_id, type, title, position, content)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'note', 'Notes', 1,
   '{"text": "Cherry blossom season: book restaurants early and get a Suica card at the airport."}'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'list', 'Packing list', 2,
   '{"items": [
      {"id": "1", "kind": "check", "text": "Passport", "checked": true},
      {"id": "2", "kind": "check", "text": "Power adapter (type A)", "checked": false},
      {"id": "3", "kind": "check", "text": "Comfortable walking shoes", "checked": false}
    ]}'),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'reservation', 'Flight to Tokyo', 3,
   '{"kind": "flight", "confirmation": "ABC123", "starts_at": "2027-04-02T09:15:00+08:00", "details": "Terminal 3, gate TBA"}')
on conflict (id) do nothing;

insert into public.itinerary_items (id, trip_id, day_date, place_id, position, start_time, duration_minutes)
select v.id::uuid, 'c0000000-0000-4000-8000-000000000001', v.day_date::date, p.id, v.position, v.start_time::time, v.duration
from (
  values
    ('c2000000-0000-4000-8000-000000000001', '2027-04-03', 'seed:tokyo-sensoji', 1, '08:00', 90),
    ('c2000000-0000-4000-8000-000000000002', '2027-04-03', 'seed:tokyo-ichiran', 2, '12:30', 60),
    ('c2000000-0000-4000-8000-000000000003', '2027-04-04', 'seed:tokyo-shibuya-crossing', 1, '18:00', 45)
) as v(id, day_date, external_id, position, start_time, duration)
join public.places p on p.external_id = v.external_id
on conflict (id) do nothing;

insert into public.budgets (trip_id, total, currency)
values ('c0000000-0000-4000-8000-000000000001', 300000, 'JPY')
on conflict (trip_id) do nothing;

insert into public.expenses (id, trip_id, amount, currency, category, date, paid_by, note)
values
  ('c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 120000, 'JPY', 'flights',
   '2027-01-15', 'd0000000-0000-4000-8000-000000000001', 'Round trip'),
  ('c3000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 1800, 'JPY', 'food',
   '2027-04-03', 'd0000000-0000-4000-8000-000000000001', 'Ichiran lunch')
on conflict (id) do nothing;

insert into public.journal_entries (id, trip_id, author_id, entry_date, body)
values
  ('c4000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001', '2027-04-03',
   'Up at 7 for Senso-ji. Almost empty, and the lanterns looked amazing in the early light.')
on conflict (id) do nothing;

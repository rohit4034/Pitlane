insert into public.inventory (stock_number, make, model, body_type, model_year, mileage_km, asking_price_aed, status)
values
  ('PL-BMW-X1-001', 'BMW', 'X1 sDrive20i', 'SUV', 2023, 18000, 145000, 'available'),
  ('PL-BMW-X3-002', 'BMW', 'X3 xDrive30i', 'SUV', 2022, 31000, 178000, 'available'),
  ('PL-AUD-Q3-003', 'Audi', 'Q3 35 TFSI', 'SUV', 2023, 22000, 139000, 'available'),
  ('PL-MER-GLA-004', 'Mercedes-Benz', 'GLA 200', 'SUV', 2022, 27000, 149000, 'available'),
  ('PL-TOY-CAM-005', 'Toyota', 'Camry 2.5', 'Sedan', 2024, 9000, 118000, 'available'),
  ('PL-BMW-320-006', 'BMW', '320i', 'Sedan', 2021, 42000, 112000, 'reserved'),
  ('PL-NIS-XTR-007', 'Nissan', 'X-Trail', 'SUV', 2022, 36000, 99000, 'sold')
on conflict (stock_number) do update set
  make = excluded.make, model = excluded.model, body_type = excluded.body_type,
  model_year = excluded.model_year, mileage_km = excluded.mileage_km,
  asking_price_aed = excluded.asking_price_aed, status = excluded.status,
  updated_at = now();

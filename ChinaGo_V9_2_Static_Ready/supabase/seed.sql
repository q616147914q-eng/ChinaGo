insert into public.cities
(slug,name_en,name_zh,province_en,tagline,description,best_months,tags)
values
('beijing','Beijing','北京','Beijing','Imperial history, modern China','The classic first stop for the Forbidden City, Great Wall, hutongs and contemporary Beijing.',array['Apr-Jun','Sep-Oct'],array['history','food','family','first-trip']),
('xian','Xi''an','西安','Shaanxi','Terracotta Warriors and Silk Road history','Ancient capital famous for the Terracotta Army, city wall and Muslim Quarter food.',array['Mar-May','Sep-Nov'],array['history','food','culture']),
('luoyang','Luoyang','洛阳','Henan','Peonies, grottoes and ancient capitals','A compact history-rich city combining Longmen Grottoes, White Horse Temple and local food.',array['Apr','Oct'],array['history','culture','food']),
('dengfeng','Dengfeng','登封','Henan','Shaolin and Chinese martial arts','The home of Shaolin Temple and a strong entry point for Kung Fu culture.',array['Mar-May','Sep-Nov'],array['kung-fu','culture','nature']),
('kaifeng','Kaifeng','开封','Henan','Song-dynasty culture and night food','A relaxed historic city known for Song culture, old streets and snacks.',array['Mar-May','Sep-Nov'],array['history','food']),
('zhengzhou','Zhengzhou','郑州','Henan','Henan gateway city','A practical transport hub for exploring central China.',array['Mar-May','Sep-Nov'],array['gateway','food'])
on conflict (slug) do nothing;

insert into public.pois (city_id,type,name_en,name_zh,description,foreigner_friendly,english_support,reservation_required,tags)
select id,'attraction','Shaolin Temple','少林寺','Historic Buddhist temple and global symbol of Shaolin Kung Fu.',true,true,false,array['kung-fu','culture'] from public.cities where slug='dengfeng'
on conflict do nothing;

insert into public.pois (city_id,type,name_en,name_zh,description,foreigner_friendly,english_support,reservation_required,tags)
select id,'attraction','Longmen Grottoes','龙门石窟','UNESCO-listed Buddhist grotto complex along the Yi River.',true,true,false,array['history','unesco','art'] from public.cities where slug='luoyang'
on conflict do nothing;

insert into public.pois (city_id,type,name_en,name_zh,description,foreigner_friendly,english_support,reservation_required,tags)
select id,'attraction','Terracotta Army','秦始皇帝陵博物院','The famous Qin-era terracotta warrior and horse figures.',true,true,true,array['history','museum'] from public.cities where slug='xian'
on conflict do nothing;

insert into public.pois (city_id,type,name_en,name_zh,description,foreigner_friendly,english_support,reservation_required,tags)
select id,'attraction','Forbidden City','故宫博物院','Former imperial palace in the heart of Beijing.',true,true,true,array['history','museum'] from public.cities where slug='beijing'
on conflict do nothing;

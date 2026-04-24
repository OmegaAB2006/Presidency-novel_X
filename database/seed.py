"""
Seed script — populates the database with demo users and items.
Run from the project root:  python3 database/seed.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import app
from models import db, User, Item, Rating
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt(app)

USERS = [
    # (username, email, password, location, address, wallet_balance)
    ('alice',   'alice@test.com',   'password123', 'Mumbai',   'Bandra West, Mumbai, Maharashtra', 5000.0),
    ('bob',     'bob@test.com',     'password123', 'Delhi',    'Connaught Place, New Delhi',        3000.0),
    ('charlie', 'charlie@test.com', 'password123', 'Bangalore','Koramangala, Bengaluru, Karnataka', 2500.0),
]

ITEMS = [
    # (owner_idx, name, category, condition, value_estimate, min_want_value, wanted_category, wanted_description, description)
    (0, 'Vintage Bicycle',        'sports',      'good',     12000, 8000,  'electronics', 'Looking for a portable speaker or headphones', 'Classic steel frame, recently serviced, single speed'),
    (0, 'Canon DSLR Camera',      'electronics', 'excellent',35000, 25000, 'sports',      'Want a good quality sports/fitness gear',       'Canon EOS 250D with 18-55mm kit lens, excellent shape'),
    (1, 'Skateboard',             'sports',      'good',     8500,  5000,  'sports',      'Looking for rollerblades or another board',     'Pro deck with new ABEC-7 wheels, lightly used'),
    (1, 'Acoustic Guitar',        'music',       'excellent',22000, 15000, 'electronics', 'Want a tablet or e-reader',                     'Yamaha FG800, great sound, barely played'),
    (2, 'iPad Pro 2022',          'electronics', 'like_new', 65000, 40000, 'music',       'Want a guitar or keyboard instrument',          '12.9 inch, 256 GB Wi-Fi, Apple Pencil 2 included'),
    (2, 'Mechanical Keyboard',    'electronics', 'good',     7500,  4000,  'gaming',      'Want gaming peripherals or accessories',        'TKL layout, Cherry MX Brown switches, RGB'),
    (0, 'Tennis Racket Set',      'sports',      'good',     6000,  3000,  'books',       'Looking for programming or design books',       'Wilson racket pair with balls and carry bag'),
    (1, 'Python Programming Book','books',       'excellent', 1800, 1000,  'books',       'Looking for other tech or self-help books',     'Fluent Python 2nd edition, mint condition'),
    (2, 'Noise Cancelling Headphones', 'electronics', 'good', 18000, 12000, 'music',     'Want a musical instrument to learn',            'Sony WH-1000XM4, great condition, with case'),
    (0, 'Badminton Set',          'sports',      'like_new', 3500,  2000,  'sports',      'Looking for any sports equipment',              'Yonex rackets x2, shuttles, full set'),
    (1, 'Gaming Controller',      'gaming',      'good',     4500,  3000,  'gaming',      'Want another controller or gaming accessory',   'PlayStation DualSense, barely used'),
    (2, 'Bluetooth Speaker',      'electronics', 'excellent', 9000, 6000,  'sports',      'Want fitness or outdoor gear',                  'JBL Charge 5, waterproof, excellent battery life'),
]

def seed():
    with app.app_context():
        db.drop_all()
        db.create_all()

        users = []
        for username, email, password, location, address, wallet in USERS:
            u = User(
                username=username,
                email=email,
                password_hash=bcrypt.generate_password_hash(password).decode(),
                location=location,
                address=address,
                wallet_balance=wallet,
            )
            db.session.add(u)
            users.append(u)
        db.session.commit()
        print(f'Created {len(users)} users.')

        items = []
        for owner_idx, name, cat, cond, value, min_want, wanted_cat, wanted_desc, desc in ITEMS:
            it = Item(
                user_id=users[owner_idx].id,
                name=name,
                category=cat,
                condition=cond,
                value_estimate=value,
                min_want_value=min_want,
                wanted_category=wanted_cat,
                wanted_description=wanted_desc,
                description=desc,
                media_urls='[]',
            )
            db.session.add(it)
            items.append(it)
        db.session.commit()
        print(f'Created {len(items)} items.')

        db.session.add(Rating(rater_id=users[1].id, ratee_id=users[0].id, rating=5, comment='Great trader, very honest!'))
        db.session.add(Rating(rater_id=users[2].id, ratee_id=users[1].id, rating=4, comment='Smooth deal, item as described'))
        db.session.add(Rating(rater_id=users[0].id, ratee_id=users[2].id, rating=5, comment='Excellent condition item, fast meetup'))
        db.session.commit()
        print('Ratings seeded.')

        print('\nDemo accounts (all passwords: password123):')
        for u in users:
            print(f'  {u.email}  |  wallet: ₹{u.wallet_balance:,.0f}  |  {u.location}')

if __name__ == '__main__':
    seed()

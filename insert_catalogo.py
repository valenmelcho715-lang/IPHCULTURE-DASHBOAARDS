#!/usr/bin/env python3
"""Inserta el catálogo completo de iPhone Culture en la base de datos SQLite."""

import sqlite3
import os

DB_PATH = '/Users/vm/Documents/kimi/workspace/iphone-culture-dashboard/iphone-culture.db'

def calc_precios(precio_base):
    """Calcula precios contado y regular según reglas del usuario."""
    # precio_base + 2% + 100/150
    con_interes = precio_base * 1.02
    contado = round(con_interes + 100)
    regular = round(con_interes + 150)
    return contado, regular

def calc_cuotas(regular):
    """Calcula cuotas sin interés sobre precio regular."""
    c3 = f"${round(regular / 3)} x 3"
    c6 = f"${round(regular / 6)} x 6"
    c9 = f"${round(regular / 9)} x 9"
    c12 = f"${round(regular / 12)} x 12"
    return c3, c6, c9, c12

def insertar(cursor, producto, modelo, descripcion, precio_base, categoria, destacado=0):
    contado, regular = calc_precios(precio_base)
    c3, c6, c9, c12 = calc_cuotas(regular)
    cursor.execute('''
        INSERT INTO catalogo (producto, modelo, descripcion, precio_contado_usd, precio_regular_usd,
                              cuotas_3, cuotas_6, cuotas_9, cuotas_12, categoria, destacado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (producto, modelo, descripcion, contado, regular, c3, c6, c9, c12, categoria, destacado))

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Limpiar catálogo anterior
    cursor.execute('DELETE FROM catalogo')
    print("Catálogo anterior limpiado.")

    # ============================================
    # iPHONES
    # ============================================
    iphones = [
        ("iPhone 16", "128GB", 835),
        ("iPhone 17", "256GB", 980),
        ("iPhone Air", "256GB", 1020),
        ("iPhone 17 Pro", "256GB", 1190),
        ("iPhone 17 Pro", "512GB", 1410),
        ("iPhone 17 Pro Max", "256GB", 1290),
        ("iPhone 17 Pro Max", "512GB", 1510),
        ("iPhone 17 Pro Max", "1TB", 1720),
        ("iPhone 17 Pro Max", "2TB", 2140),
    ]
    for prod, mod, base in iphones:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "iPhone", destacado=1 if "Pro Max" in prod else 0)

    # ============================================
    # APPLE WATCH
    # ============================================
    watches = [
        ("Apple Watch SE 3", "40mm", 330),
        ("Apple Watch SE 3", "44mm", 360),
        ("Apple Watch SE 3 + CELL", "40mm", 410),
        ("Apple Watch SE 3 + CELL", "44mm", 440),
        ("Apple Watch S11", "42mm", 435),
        ("Apple Watch S11", "46mm", 465),
        ("Apple Watch S11 + CELL", "42mm", 670),
        ("Apple Watch S11 + CELL", "46mm", 700),
        ("Apple Watch Ultra 3 + CELL", "49mm", 835),
    ]
    for prod, mod, base in watches:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "Apple Watch")

    # ============================================
    # AIRPODS
    # ============================================
    airpods = [
        ("AirPods 4", "Standard", 165),
        ("AirPods 4", "Cancelación Activa de Ruido", 205),
        ("AirPods Pro 3rd Gen", "2025", 305),
        ("AirPods Max USB-C", "-", 585),
    ]
    for prod, mod, base in airpods:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "AirPods")

    # ============================================
    # VARIOS (AirTag, Apple TV)
    # ============================================
    varios = [
        ("AirTag", "1 Pack", 75),
        ("AirTag", "4 Pack", 170),
        ("Apple TV 4K", "128GB", 290),
    ]
    for prod, mod, base in varios:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "Accesorio")

    # ============================================
    # ACCESORIOS APPLE ORIGINAL
    # ============================================
    acc_orig = [
        ("20W USB-C Power Adapter", "Original", 25),
        ("30W USB-C Power Adapter", "MacBook Air Original", 40),
    ]
    for prod, mod, base in acc_orig:
        insertar(cursor, prod, mod, f"Original Apple", base, "Accesorio")

    # ============================================
    # ACCESORIOS APPLE REPLICA AAA
    # ============================================
    acc_rep = [
        ("Lightning to USB Cable (1m)", "Clase AAA", 10),
        ("USB-C to Lightning Cable (1m)", "Clase AAA", 10),
    ]
    for prod, mod, base in acc_rep:
        insertar(cursor, prod, mod, f"Replica Clase AAA", base, "Accesorio")

    # ============================================
    # iPAD
    # ============================================
    ipads = [
        ("iPad Mini 8.3\" A17 Pro (7th Gen)", "128GB", 585),
        ("iPad Mini 8.3\" A17 Pro (7th Gen)", "256GB", 685),
        ("iPad 11\" A16 (11th Gen)", "128GB", 450),
        ("iPad 11\" A16 (11th Gen)", "256GB", 560),
        ("iPad Air 11\" M3", "128GB", 640),
        ("iPad Air 11\" M4", "128GB", 720),
        ("iPad Air 11\" M4", "256GB", 820),
        ("iPad Air 13\" M3", "128GB", 890),
        ("iPad Air 13\" M3", "256GB", 990),
        ("iPad Air 13\" M4", "128GB", 960),
        ("iPad Air 13\" M4", "256GB", 1060),
        ("iPad Pro 11\" M5", "256GB", 1090),
        ("iPad Pro 11\" M5", "512GB", 1330),
        ("iPad Pro 11\" M5 + CELL", "256GB", 1400),
        ("iPad Pro 11\" M5 + CELL", "512GB", 1615),
        ("iPad Pro 13\" M5", "256GB", 1420),
        ("iPad Pro 13\" M5", "512GB", 1660),
        ("iPad Pro 13\" M5", "1TB", 2235),
        ("iPad Pro 13\" M5", "2TB", 2710),
        ("iPad Pro 13\" M5 + CELL", "256GB", 1760),
        ("iPad Pro 13\" M5 + CELL", "512GB", 1980),
    ]
    for prod, mod, base in ipads:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "iPad")

    # Accesorios iPad
    acc_ipad = [
        ("Magic Keyboard 11\" for iPad Pro M4", "-", 415),
        ("Magic Keyboard 13\" for iPad Pro M4", "-", 465),
        ("Apple Pencil USB-C", "-", 105),
        ("Apple Pencil Pro", "-", 140),
    ]
    for prod, mod, base in acc_ipad:
        insertar(cursor, prod, mod, f"Original Apple", base, "Accesorio")

    # ============================================
    # MACBOOK / iMAC / MAC MINI / MAC STUDIO / DISPLAY
    # ============================================
    macs = [
        ("MacBook Neo A18 Pro 13\"", "8RAM/256GB/6Core/5GPU", 765),
        ("MacBook Neo A18 Pro 13\"", "8RAM/512GB/6Core/5GPU", 865),
        ("MacBook Air M5 13.6\"", "16RAM/512GB/10CPU/8GPU", 1380),
        ("MacBook Air M5 13.6\"", "16RAM/1TB/10CPU/10GPU", 1545),
        ("MacBook Air M5 13.6\"", "24RAM/1TB/10CPU/10GPU", 1855),
        ("MacBook Air M5 15.3\"", "16RAM/512GB/10CPU/10GPU", 1430),
        ("MacBook Air M5 15.3\"", "16RAM/1TB/10CPU/10GPU", 2010),
        ("MacBook Air M5 15.3\"", "24RAM/1TB/10CPU/10GPU", 1895),
        ("MacBook Pro M5 14.2\"", "16RAM/1TB/10CPU/10GPU", 2270),
        ("MacBook Pro M5 14.2\"", "24RAM/1TB/10CPU/10GPU", 2475),
        ("MacBook Pro M5 14.2\"", "32RAM/1TB/10CPU/10GPU", 2735),
        ("MacBook Pro M5 Pro 14.2\"", "24RAM/1TB/15CPU/16GPU", 2460),
        ("MacBook Pro M5 Pro 14.2\"", "24RAM/2TB/15CPU/16GPU", 2945),
        ("MacBook Pro M5 Pro 14.2\"", "24RAM/2TB/18CPU/20GPU", 3255),
        ("MacBook Pro M5 Pro 14.2\"", "48RAM/1TB/15CPU/16GPU", 3100),
        ("MacBook Pro M5 Pro 14.2\"", "48RAM/1TB/18CPU/20GPU", 3305),
        ("MacBook Pro M5 Max 14.2\"", "36RAM/2TB/18CPU/32GPU", 4025),
        ("MacBook Pro M5 Max 14.2\"", "48RAM/2TB/18CPU/40GPU", 4750),
        ("MacBook Pro M5 Pro 16.2\"", "24RAM/1TB/18CPU/20GPU", 2995),
        ("MacBook Pro M5 Pro 16.2\"", "48RAM/1TB/18CPU/20GPU", 3460),
        ("MacBook Pro M5 Max 16.2\"", "36RAM/2TB/18CPU/32GPU", 4390),
        ("MacBook Pro M5 Max 16.2\"", "48RAM/2TB/18CPU/40GPU", 4955),
        ("iMac M4 24\"", "16RAM/256GB/8CPU/8GPU", 2050),
        ("iMac M4 24\"", "16RAM/256GB/10CPU/10GPU", 2255),
        ("iMac M4 24\"", "16RAM/512GB/10CPU/10GPU", 2460),
        ("iMac M4 24\"", "24RAM/512GB/10CPU/10GPU", 2670),
        ("iMac M4 24\"", "24RAM/1TB/10CPU/10GPU", 3440),
        ("iMac M4 24\"", "32RAM/1TB/10CPU/10GPU", 3645),
        ("Apple Studio Display 27\"", "Standard Glass Tilt Adjustable", 2925),
        ("Apple Studio Display 27\"", "Standard Glass Tilt&Height Adjustable", 3030),
        ("Apple Studio Display 27\"", "Nano-Texture Glass Tilt Adjustable", 3335),
        ("Mac Studio M3 Ultra", "64RAM/1TB/28CPU/60GPU", 4760),
        ("Mac Studio M4 Max", "36RAM/512GB/14CPU/32GPU", 2700),
        ("Mac Studio M4 Max", "128RAM/1TB/16CPU/40GPU", 4760),
    ]
    for prod, mod, base in macs:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial 1 año", base, "MacBook", destacado=1 if "Pro" in prod else 0)

    # Accesorios Mac
    acc_mac = [
        ("Magic Mouse 2", "White", 145),
        ("Magic Mouse 2", "Black", 165),
        ("Magic TrackPad 2", "Black", 260),
        ("Magic Keyboard With Touch ID and Numeric Keypad", "-", 320),
    ]
    for prod, mod, base in acc_mac:
        insertar(cursor, prod, mod, f"Original Apple", base, "Accesorio")

    # ============================================
    # CONSOLAS / GAMING / VARIOS
    # ============================================
    consolas = [
        ("PS5 Slim", "825GB Digital", 660),
        ("Joystick PS5 Original", "DualSense", 85),
        ("PS5 VR2 + Horizon Call Of The Mountain", "-", 565),
        ("Portal Remote Player PS5", "-", 390),
        ("Joystick Xbox S/X Original", "-", 80),
        ("Nintendo Switch 2", "256GB", 600),
        ("Volante Logitech G923", "PC/Xbox", 395),
        ("Palanca de Cambios G29/G923", "-", 75),
        ("Meta Quest 3S", "128GB + Batman", 480),
        ("Meta Quest 3S", "256GB + Batman", 540),
    ]
    for prod, mod, base in consolas:
        insertar(cursor, prod, mod, f"Sellado | Garantía oficial", base, "Accesorio")

    # ============================================
    # SAMSUNG (Importado, Garantía 3 meses)
    # ============================================
    samsung = [
        ("Samsung A06", "4/64GB", 140),
        ("Samsung A07", "4/64GB", 145),
        ("Samsung A07", "4/128GB", 165),
        ("Samsung A16", "4/128GB", 180),
        ("Samsung A17", "4/128GB", 205),
        ("Samsung A26 5G", "8/256GB", 300),
        ("Samsung A27 5G", "8/256GB", 395),
        ("Samsung A36 5G", "8/256GB", 355),
        ("Samsung A56 5G", "8/128GB", 430),
        ("Samsung A56 5G", "8/256GB", 440),
        ("Samsung A56 5G", "12/256GB", 450),
        ("Samsung A57 5G", "8/256GB", 475),
        ("Samsung S25 FE", "8/128GB", 540),
        ("Samsung S25 Ultra", "12/256GB", 930),
        ("Samsung S25 Ultra", "12/512GB", 985),
        ("Samsung S25 Ultra", "12/1TB", 1040),
        ("Samsung S26", "12/256GB", 775),
        ("Samsung S26", "12/512GB", 910),
        ("Samsung S26 Plus", "12/256GB", 930),
        ("Samsung S26 Plus", "12/512GB", 1045),
        ("Samsung S26 Ultra", "12/256GB", 1045),
        ("Samsung S26 Ultra", "12/512GB", 1200),
        ("Samsung S26 Ultra", "16/1TB", 1475),
        ("Samsung 25W Power Adapter", "Original", 20),
    ]
    for prod, mod, base in samsung:
        insertar(cursor, prod, mod, f"Importado | Garantía 3 meses", base, "Android")

    # ============================================
    # XIAOMI (Importado, Garantía 3 meses)
    # ============================================
    xiaomi = [
        ("Xiaomi Redmi A5", "4/128GB", 170),
        ("Xiaomi Redmi A7 Pro", "4/64GB", 145),
        ("Xiaomi Redmi 15", "6/128GB", 205),
        ("Xiaomi Redmi 15", "8/256GB", 235),
        ("Xiaomi Redmi 15C", "4/128GB", 175),
        ("Xiaomi Redmi 15C", "4/256GB", 195),
        ("Xiaomi Redmi 15C", "8/256GB", 220),
        ("Xiaomi Redmi Note 14", "8/256GB", 245),
        ("Xiaomi Redmi Note 14S", "8/256GB", 250),
        ("Xiaomi Redmi Note 14 Pro 5G", "8/256GB", 325),
        ("Xiaomi Redmi Note 14 Pro+ 5G", "12/512GB", 450),
        ("Xiaomi Redmi Note 15", "6/128GB", 225),
        ("Xiaomi Redmi Note 15", "8/256GB", 255),
        ("Xiaomi Redmi Note 15 5G", "8/256GB", 300),
        ("Xiaomi Redmi Note 15 Pro", "8/256GB", 325),
        ("Xiaomi Redmi Note 15 Pro", "12/512GB", 365),
        ("Xiaomi Redmi Note 15 Pro 5G", "8/256GB", 360),
        ("Xiaomi Redmi Note 15 Pro 5G", "12/512GB", 440),
        ("Xiaomi Redmi Note 15 Pro+ 5G", "8/256GB", 415),
        ("Xiaomi Redmi Note 15 Pro+ 5G", "12/256GB", 440),
        ("Xiaomi Redmi Note 15 Pro+ 5G", "12/512GB", 485),
        ("Xiaomi Poco C71", "4/64GB", 145),
        ("Xiaomi Poco C71", "4/128GB", 165),
        ("Xiaomi Poco C81 Pro", "4/128GB", 170),
        ("Xiaomi Poco C81 Pro", "4/256GB", 190),
        ("Xiaomi Poco C85", "8/256GB", 215),
        ("Xiaomi Poco M7", "6/128GB", 185),
        ("Xiaomi Poco M7", "8/256GB", 240),
        ("Xiaomi Poco M8S 5G", "6/128GB", 260),
        ("Xiaomi Poco M8S 5G", "8/256GB", 285),
        ("Xiaomi Poco M8 5G", "8/512GB", 310),
        ("Xiaomi Poco M8 Pro 5G", "8/256GB", 325),
        ("Xiaomi Poco M8 Pro 5G", "12/512GB", 390),
        ("Xiaomi Poco X7 Pro 5G", "8/256GB", 390),
        ("Xiaomi Poco X7 Pro 5G", "12/256GB", 395),
        ("Xiaomi Poco X7 Pro 5G", "12/512GB", 420),
        ("Xiaomi Poco X8 Pro 5G", "8/256GB", 430),
        ("Xiaomi Poco X8 Pro 5G", "8/512GB", 445),
        ("Xiaomi Poco X8 Pro 5G", "12/512GB", 480),
        ("Xiaomi Poco X8 Pro Max 5G", "12/256GB", 525),
        ("Xiaomi Poco X8 Pro Max 5G", "12/512GB", 605),
        ("Xiaomi Poco F7 5G", "12/512GB", 530),
        ("Xiaomi Poco F8 Pro 5G", "12/256GB", 605),
        ("Xiaomi Poco F8 Pro 5G", "12/512GB", 655),
        ("Xiaomi Poco F8 Ultra 5G", "12/256GB", 805),
        ("Xiaomi Poco F8 Ultra 5G", "16/512GB", 885),
        ("Xiaomi Mix Flip 5G", "12/512GB", 675),
        ("Xiaomi 15T 5G", "12/512GB (S/Cargador)", 655),
        ("Xiaomi 15T 5G", "12/512GB", 700),
        ("Xiaomi 15T Pro 5G", "12/256GB", 725),
        ("Xiaomi 15T Pro 5G", "12/512GB", 875),
        ("Xiaomi 17 5G", "12/512GB", 960),
        ("Xiaomi 17T 5G", "12/512GB", 740),
        ("Xiaomi 17T Pro 5G", "12/256GB", 795),
        ("Xiaomi 17T Pro 5G", "12/512GB", 850),
        ("Xiaomi 17 Ultra 5G", "16/512GB", 1365),
    ]
    for prod, mod, base in xiaomi:
        insertar(cursor, prod, mod, f"Importado | Garantía 3 meses", base, "Android")

    # ============================================
    # MOTOROLA (Importado, Garantía 3 meses)
    # ============================================
    motorola = [
        ("Motorola E15", "2/64GB", 140),
        ("Motorola G05", "4/64GB", 150),
        ("Motorola G05", "4/128GB", 155),
        ("Motorola G05", "4/256GB (S/Cargador)", 165),
        ("Motorola G06", "4/128GB", 155),
        ("Motorola G06", "8/256GB (S/Cargador)", 185),
        ("Motorola G06 Power", "4/256GB", 165),
        ("Motorola G15", "8/128GB (S/Cargador)", 180),
        ("Motorola G15", "4/512GB", 210),
        ("Motorola G17", "4/256GB", 215),
        ("Motorola G17 Power", "8/256GB", 245),
        ("Motorola G35 5G", "4/128GB (S/Cargador)", 190),
        ("Motorola G56 5G", "8/256GB", 265),
        ("Motorola G56 5G", "12/256GB", 270),
        ("Motorola G57 Power 5G", "12/256GB (S/Cargador)", 290),
        ("Motorola G67", "4/256GB", 295),
        ("Motorola G67 Power 5G", "8/128GB", 245),
        ("Motorola G77", "8/256GB", 305),
        ("Motorola G86 5G", "8/256GB (S/Cargador)", 280),
        ("Motorola G86 5G", "8/256GB", 290),
        ("Motorola G86 5G", "8/512GB", 305),
        ("Motorola G86 Power 5G", "8/128GB", 265),
        ("Motorola G96 5G", "8/128GB", 275),
        ("Motorola Edge 40 Pro", "12/256GB", 325),
        ("Motorola Edge 50 5G", "12/512GB", 385),
        ("Motorola Edge 60 5G", "8/256GB (S/Cargador)", 320),
        ("Motorola Edge 60 5G", "12/512GB (S/Cargador)", 385),
        ("Motorola Edge 60 Fusion 5G", "8/256GB (S/Cargador)", 305),
        ("Motorola Edge 60 Fusion 5G", "12/256GB", 355),
        ("Motorola Edge 60 Pro 5G", "8/256GB", 385),
        ("Motorola Edge 70 5G", "8/256GB", 490),
        ("Motorola Edge 70 Fusion 5G", "8/256GB", 460),
        ("Motorola Razr 50 5G", "12/512GB", 635),
    ]
    for prod, mod, base in motorola:
        insertar(cursor, prod, mod, f"Importado | Garantía 3 meses", base, "Android")

    conn.commit()
    
    # Verificar
    cursor.execute('SELECT COUNT(*) FROM catalogo')
    count = cursor.fetchone()[0]
    print(f"\n✅ Catálogo insertado: {count} productos")
    
    # Mostrar muestra
    cursor.execute('SELECT producto, modelo, precio_contado_usd, precio_regular_usd, cuotas_3 FROM catalogo WHERE categoria = ? LIMIT 5', ('iPhone',))
    print("\n📱 Muestra iPhones:")
    for row in cursor.fetchall():
        print(f"  {row[0]} {row[1]} | Contado: ${row[2]} | Regular: ${row[3]} | {row[4]}")
    
    cursor.execute('SELECT producto, modelo, precio_contado_usd, precio_regular_usd, cuotas_3 FROM catalogo WHERE categoria = ? LIMIT 3', ('Android',))
    print("\n📱 Muestra Android:")
    for row in cursor.fetchall():
        print(f"  {row[0]} {row[1]} | Contado: ${row[2]} | Regular: ${row[3]} | {row[4]}")

    conn.close()

if __name__ == '__main__':
    main()

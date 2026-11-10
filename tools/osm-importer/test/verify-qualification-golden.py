"""Independent standard-library oracle. Never imports the TypeScript implementation.
Golden JSON decimal coordinates are interpreted as exact decimal strings; no JVM
parity is claimed. Run: python3 tools/osm-importer/test/verify-qualification-golden.py
"""
from decimal import Decimal, ROUND_HALF_EVEN
from hashlib import sha256
from pathlib import Path
import json


def fixed(value):
    quantized = Decimal(value).quantize(Decimal('0.0000001'), rounding=ROUND_HALF_EVEN)
    return '0.0000000' if quantized == 0 else format(quantized, '.7f')


def main():
    golden = json.loads(Path(__file__).with_name('qualification-geometry-golden.json').read_text(), parse_float=Decimal)
    for item in golden:
        edge = item['edge']
        start, end = edge['fromNodeId'], edge['toNodeId']
        geometry = ';'.join(f"{fixed(p['lat'])},{fixed(p['lon'])}" for p in edge['geometry'])
        canonical = (f'edge-geometry-v2-decimal-half-even|EDGE:{len(start)}:{start}->'
                     f"{len(end)}:{end}|FWD:{str(edge['isWayForward']).lower()}|GEO:{geometry}")
        assert canonical == item['canonical']
        assert sha256(canonical.encode('utf-8')).hexdigest() == item['sha256']
    for source, expected in [('0.00390625', '0.0039062'), ('-0.00390625', '-0.0039062'),
                             ('0.00390635', '0.0039064'), ('-0.00390635', '-0.0039064'),
                             ('0.00000005', '0.0000000'), ('-0.00000005', '0.0000000')]:
        assert fixed(source) == expected
    print(f'{len(golden)} V2 SHA-256 vectors and 6 decimal Half-Even vectors PASS')


if __name__ == '__main__':
    main()

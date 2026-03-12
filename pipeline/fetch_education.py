import pandas as pd
import numpy as np
import json, math, os

print("Building education dataset...")

CORP_COUNTY = {
    '0015':('18001','Adams'),'0025':('18001','Adams'),'0035':('18001','Adams'),
    '0125':('18003','Allen'),'0225':('18003','Allen'),'0235':('18003','Allen'),'0255':('18003','Allen'),
    '0365':('18005','Bartholomew'),'0370':('18005','Bartholomew'),
    '0395':('18007','Benton'),
    '0515':('18009','Blackford'),
    '0615':('18011','Boone'),'0630':('18011','Boone'),'0665':('18011','Boone'),
    '0670':('18013','Brown'),
    '0750':('18015','Carroll'),'0755':('18015','Carroll'),'0775':('18015','Carroll'),
    '0815':('18017','Cass'),'0875':('18017','Cass'),
    '0935':('18019','Clark'),'0945':('18019','Clark'),'1000':('18019','Clark'),'1010':('18019','Clark'),
    '1125':('18021','Clay'),
    '1150':('18023','Clinton'),'1160':('18023','Clinton'),'1170':('18023','Clinton'),'1180':('18023','Clinton'),
    '1300':('18025','Crawford'),
    '1315':('18027','Daviess'),'1375':('18027','Daviess'),'1405':('18027','Daviess'),
    '1560':('18029','Dearborn'),'1600':('18029','Dearborn'),'1620':('18029','Dearborn'),
    '1655':('18031','Decatur'),'1730':('18031','Decatur'),
    '1805':('18033','DeKalb'),'1820':('18033','DeKalb'),'1835':('18033','DeKalb'),
    '1875':('18035','Delaware'),'1885':('18035','Delaware'),'1895':('18035','Delaware'),
    '1900':('18035','Delaware'),'1910':('18035','Delaware'),'1940':('18035','Delaware'),'1970':('18035','Delaware'),
    '2040':('18037','Dubois'),'2100':('18037','Dubois'),'2110':('18037','Dubois'),'2120':('18037','Dubois'),
    '2155':('18039','Elkhart'),'2260':('18039','Elkhart'),'2270':('18039','Elkhart'),
    '2275':('18039','Elkhart'),'2285':('18039','Elkhart'),'2305':('18039','Elkhart'),'2315':('18039','Elkhart'),
    '2395':('18041','Fayette'),
    '2400':('18043','Floyd'),
    '2435':('18045','Fountain'),'2440':('18045','Fountain'),'2455':('18045','Fountain'),
    '2475':('18047','Franklin'),
    '2645':('18049','Fulton'),'2650':('18049','Fulton'),
    '2725':('18051','Gibson'),'2735':('18051','Gibson'),'2765':('18051','Gibson'),
    '2815':('18053','Grant'),'2825':('18053','Grant'),'2855':('18053','Grant'),'2865':('18053','Grant'),
    '2920':('18055','Greene'),'2940':('18055','Greene'),'2950':('18055','Greene'),'2960':('18055','Greene'),'2980':('18055','Greene'),
    '3005':('18057','Hamilton'),'3025':('18057','Hamilton'),'3030':('18057','Hamilton'),
    '3055':('18057','Hamilton'),'3060':('18057','Hamilton'),'3070':('18057','Hamilton'),
    '3115':('18059','Hancock'),'3125':('18059','Hancock'),'3135':('18059','Hancock'),'3145':('18059','Hancock'),
    '3160':('18061','Harrison'),'3180':('18061','Harrison'),'3190':('18061','Harrison'),
    '3295':('18063','Hendricks'),'3305':('18063','Hendricks'),'3315':('18063','Hendricks'),
    '3325':('18063','Hendricks'),'3330':('18063','Hendricks'),'3335':('18063','Hendricks'),
    '3405':('18065','Henry'),'3415':('18065','Henry'),'3435':('18065','Henry'),'3445':('18065','Henry'),'3455':('18065','Henry'),
    '3460':('18067','Howard'),'3470':('18067','Howard'),'3480':('18067','Howard'),'3490':('18067','Howard'),'3500':('18067','Howard'),
    '3625':('18069','Huntington'),
    '3640':('18071','Jackson'),'3675':('18071','Jackson'),'3695':('18071','Jackson'),'3710':('18071','Jackson'),
    '3785':('18073','Jasper'),'3815':('18073','Jasper'),
    '3945':('18075','Jay'),
    '3995':('18077','Jefferson'),'4000':('18077','Jefferson'),
    '4015':('18079','Jennings'),
    '4145':('18081','Johnson'),'4205':('18081','Johnson'),'4215':('18081','Johnson'),
    '4225':('18081','Johnson'),'4245':('18081','Johnson'),'4255':('18081','Johnson'),
    '4315':('18083','Knox'),'4325':('18083','Knox'),'4335':('18083','Knox'),
    '4345':('18085','Kosciusko'),'4415':('18085','Kosciusko'),'4445':('18085','Kosciusko'),'4455':('18085','Kosciusko'),
    '4515':('18087','LaGrange'),'4525':('18087','LaGrange'),'4535':('18087','LaGrange'),
    '4580':('18089','Lake'),'4590':('18089','Lake'),'4600':('18089','Lake'),'4615':('18089','Lake'),
    '4645':('18089','Lake'),'4650':('18089','Lake'),'4660':('18089','Lake'),'4670':('18089','Lake'),
    '4680':('18089','Lake'),'4690':('18089','Lake'),'4700':('18089','Lake'),'4710':('18089','Lake'),
    '4720':('18089','Lake'),'4730':('18089','Lake'),'4740':('18089','Lake'),'4760':('18089','Lake'),
    '4805':('18091','LaPorte'),'4860':('18091','LaPorte'),'4915':('18091','LaPorte'),
    '4925':('18091','LaPorte'),'4940':('18091','LaPorte'),'4945':('18091','LaPorte'),
    '5075':('18093','Lawrence'),'5085':('18093','Lawrence'),
    '5245':('18095','Madison'),'5255':('18095','Madison'),'5265':('18095','Madison'),
    '5275':('18095','Madison'),'5280':('18095','Madison'),
    '5300':('18097','Marion'),'5310':('18097','Marion'),'5330':('18097','Marion'),
    '5340':('18097','Marion'),'5350':('18097','Marion'),'5360':('18097','Marion'),
    '5370':('18097','Marion'),'5375':('18097','Marion'),'5380':('18097','Marion'),
    '5385':('18097','Marion'),'5400':('18097','Marion'),
    '5455':('18099','Marshall'),'5470':('18099','Marshall'),'5480':('18099','Marshall'),
    '5485':('18099','Marshall'),'5495':('18099','Marshall'),
    '5520':('18101','Martin'),'5525':('18101','Martin'),
    '5615':('18103','Miami'),'5620':('18103','Miami'),'5625':('18103','Miami'),'5635':('18103','Miami'),
    '5705':('18105','Monroe'),'5740':('18105','Monroe'),
    '5835':('18107','Montgomery'),'5845':('18107','Montgomery'),'5855':('18107','Montgomery'),
    '5900':('18109','Morgan'),'5910':('18109','Morgan'),'5925':('18109','Morgan'),'5930':('18109','Morgan'),
    '5945':('18111','Newton'),'5995':('18111','Newton'),
    '6055':('18113','Noble'),'6060':('18113','Noble'),'6065':('18113','Noble'),
    '6080':('18115','Ohio'),
    '6145':('18117','Orange'),'6155':('18117','Orange'),'6160':('18117','Orange'),
    '6195':('18119','Owen'),
    '6260':('18121','Parke'),'6375':('18121','Parke'),
    '6325':('18123','Perry'),'6340':('18123','Perry'),'6350':('18123','Perry'),
    '6445':('18125','Pike'),
    '6460':('18127','Porter'),'6470':('18127','Porter'),'6510':('18127','Porter'),
    '6520':('18127','Porter'),'6530':('18127','Porter'),'6550':('18127','Porter'),'6560':('18127','Porter'),
    '6590':('18129','Posey'),'6600':('18129','Posey'),
    '6620':('18131','Pulaski'),'6630':('18131','Pulaski'),
    '6705':('18133','Putnam'),'6715':('18133','Putnam'),'6750':('18133','Putnam'),'6755':('18133','Putnam'),
    '6795':('18135','Randolph'),'6805':('18135','Randolph'),'6820':('18135','Randolph'),
    '6825':('18135','Randolph'),'6835':('18135','Randolph'),
    '6865':('18137','Ripley'),'6895':('18137','Ripley'),'6900':('18137','Ripley'),'6910':('18137','Ripley'),
    '6995':('18139','Rush'),
    '7150':('18141','St. Joseph'),'7175':('18141','St. Joseph'),'7200':('18141','St. Joseph'),
    '7205':('18141','St. Joseph'),'7215':('18141','St. Joseph'),
    '7230':('18143','Scott'),'7255':('18143','Scott'),
    '7285':('18145','Shelby'),'7350':('18145','Shelby'),'7360':('18145','Shelby'),'7365':('18145','Shelby'),
    '7385':('18147','Spencer'),'7445':('18147','Spencer'),
    '7495':('18149','Starke'),'7515':('18149','Starke'),'7525':('18149','Starke'),
    '7605':('18151','Steuben'),'7610':('18151','Steuben'),'7615':('18151','Steuben'),
    '7645':('18153','Sullivan'),'7715':('18153','Sullivan'),'9950':('18153','Sullivan'),
    '7775':('18155','Switzerland'),
    '7855':('18157','Tippecanoe'),'7865':('18157','Tippecanoe'),'7875':('18157','Tippecanoe'),
    '7935':('18159','Tipton'),'7945':('18159','Tipton'),
    '7950':('18161','Union'),
    '7995':('18163','Vanderburgh'),
    '8010':('18165','Vermillion'),'8020':('18165','Vermillion'),
    '8030':('18167','Vigo'),
    '8045':('18169','Wabash'),'8050':('18169','Wabash'),'8060':('18169','Wabash'),
    '8115':('18171','Warren'),
    '8130':('18173','Warrick'),
    '8205':('18175','Washington'),'8215':('18175','Washington'),'8220':('18175','Washington'),
    '8305':('18177','Wayne'),'8355':('18177','Wayne'),'8360':('18177','Wayne'),
    '8375':('18177','Wayne'),'8385':('18177','Wayne'),
    '8425':('18179','Wells'),'8435':('18179','Wells'),'8445':('18179','Wells'),
    '8515':('18181','White'),'8525':('18181','White'),'8535':('18181','White'),'8565':('18181','White'),
    '8625':('18183','Whitley'),'8665':('18183','Whitley'),
}

def wavg(df, val_col, wt_col):
    d = df[[val_col, wt_col]].apply(pd.to_numeric, errors='coerce').dropna()
    if len(d) == 0 or d[wt_col].sum() == 0: return None
    return float((d[val_col] * d[wt_col]).sum() / d[wt_col].sum())

def process_ilearn_sheet(sheet_name, pct_col, tested_col, result_key):
    df = pd.read_excel('data/ilearn_corp.xlsx', sheet_name=sheet_name, skiprows=4, header=[0,1])
    df.columns = [f'col_{i}' for i in range(len(df.columns))]
    df = df.iloc[1:].reset_index(drop=True)
    df['corp_id']  = df['col_0'].astype(str).str.strip().str.zfill(4)
    df['pct']      = pd.to_numeric(df[f'col_{pct_col}'],    errors='coerce')
    df['tested']   = pd.to_numeric(df[f'col_{tested_col}'], errors='coerce')
    df['fips']     = df['corp_id'].map(lambda x: CORP_COUNTY.get(x,(None,None))[0])
    mapped = df[df['fips'].notna()]
    result = mapped.groupby('fips').apply(
        lambda g: pd.Series({result_key: wavg(g,'pct','tested'), f'{result_key}_tested': g['tested'].sum()})
    ).reset_index()
    print(f"  {sheet_name}: {len(result)} counties")
    return result

# ── ILEARN sheets ──────────────────────────────────────────────────────────────
print("Processing ILEARN...")
ela      = process_ilearn_sheet('ELA',          50, 49, 'ela_proficient_pct')
math     = process_ilearn_sheet('Math',         50, 49, 'math_proficient_pct')
ela_math = process_ilearn_sheet('ELA & Math',   22, 21, 'ela_math_proficient_pct')
science  = process_ilearn_sheet('Science',      22, 21, 'science_proficient_pct')

# ── Graduation Rate ────────────────────────────────────────────────────────────
print("Processing graduation rate...")
grad_raw = pd.read_excel('data/grad_rate.xlsx',
                          sheet_name='Corp Disagg', header=1)
grad = grad_raw.iloc[1:].reset_index(drop=True)
# Flatten column names
flat = ['corp_id','corp_name']
groups = ['asian','black','hisp','multi','nhpi','white','paid','frl','gen','sped','nell','ell','female','male','total']
for g in groups:
    flat += [f'{g}_cohort', f'{g}_grads', f'{g}_rate']
flat += ['adj_note']
grad.columns = flat[:len(grad.columns)]
grad['corp_id']      = grad['corp_id'].astype(str).str.strip().str.zfill(4)
grad['total_cohort'] = pd.to_numeric(grad['total_cohort'], errors='coerce')
grad['grad_rate']    = pd.to_numeric(grad['total_rate'],   errors='coerce')
grad['fips']         = grad['corp_id'].map(lambda x: CORP_COUNTY.get(x,(None,None))[0])
grad_mapped = grad[grad['fips'].notna()]
county_grad = grad_mapped.groupby('fips').apply(
    lambda g: pd.Series({'grad_rate': wavg(g,'grad_rate','total_cohort'),
                         'grad_cohort_total': g['total_cohort'].sum()})
).reset_index()
print(f"  Graduation: {len(county_grad)} counties")

# ── Chronic Absenteeism ────────────────────────────────────────────────────────
print("Processing chronic absenteeism...")
absent_raw = pd.read_excel('data/chronic_absent.xlsx', sheet_name='Corp')
absent = absent_raw[absent_raw['SCHOOL_YEAR']==2025].copy()
absent['corp_id'] = absent['IDOE_CORPORATION_ID'].astype(str).str.strip().str.zfill(4)
absent['fips']    = absent['corp_id'].map(lambda x: CORP_COUNTY.get(x,(None,None))[0])
absent_mapped = absent[absent['fips'].notna()]
county_absent = absent_mapped.groupby('fips').apply(
    lambda g: pd.Series({'chronic_absent_rate': wavg(g,'Chronically Absent Percent','Total Student Count'),
                         'total_students': g['Total Student Count'].sum()})
).reset_index()
print(f"  Absenteeism: {len(county_absent)} counties")

# ── Merge all ──────────────────────────────────────────────────────────────────
df = ela.merge(math, on='fips', how='outer')
df = df.merge(ela_math, on='fips', how='outer')
df = df.merge(science,  on='fips', how='outer')
df = df.merge(county_grad,  on='fips', how='outer')
df = df.merge(county_absent, on='fips', how='outer')

econ = pd.read_csv('data/indiana_counties_master.csv')
econ['fips'] = econ['fips'].apply(lambda x: f"{int(x):05d}")
df = df.merge(econ[['fips','county_name','total_population']], on='fips', how='left')

for col in ['ela_proficient_pct','math_proficient_pct','ela_math_proficient_pct',
            'science_proficient_pct','grad_rate','chronic_absent_rate']:
    df[col] = pd.to_numeric(df[col], errors='coerce').round(4)

df.to_csv('data/indiana_education_master.csv', index=False)
print(f"\nSaved: {len(df)} counties, {len(df.columns)} columns")
print("\nTop 10 by graduation rate:")
print(df[['county_name','grad_rate','ela_proficient_pct','math_proficient_pct','chronic_absent_rate']].dropna(subset=['grad_rate']).sort_values('grad_rate', ascending=False).head(10).to_string())

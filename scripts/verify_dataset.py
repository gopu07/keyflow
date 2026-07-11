import os
import json
import sys

# Resolve quotes path relative to the script directory to run seamlessly locally and in CI/CD environments
script_dir = os.path.dirname(os.path.abspath(__file__))
quotes_dir = os.path.join(script_dir, "..", "src", "data", "quotes")
categories = [
    "books", "funfacts", "gaming", "history", "motivation", "movies", 
    "philosophy", "programming", "science", "space", "sports", "startups", "technology"
]

errors = []
total_quotes = 0
all_texts = {}

print("Starting Quote Library Dataset Validation...")
print("-" * 50)

for cat in categories:
    filename = f"{cat}.json"
    filepath = os.path.join(quotes_dir, filename)
    
    if not os.path.exists(filepath):
        errors.append(f"Missing category file: {filename}")
        continue
        
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            quotes = json.load(f)
    except Exception as e:
        errors.append(f"Failed to parse {filename}: {e}")
        continue
        
    count = len(quotes)
    total_quotes += count
    print(f"Checking {filename} | Quotes Count: {count}")
    
    # 1. Count check
    if count < 200:
        errors.append(f"Category '{cat}' has only {count} quotes (requires at least 200)")
        
    # 2. Quote Schema & Value check
    for idx, q in enumerate(quotes):
        q_id = q.get("id")
        text = q.get("text")
        author = q.get("author")
        source = q.get("source")
        category = q.get("category")
        license_val = q.get("license")
        difficulty = q.get("difficulty")
        length = q.get("length")
        
        # Check required fields
        for field, val in [("id", q_id), ("text", text), ("author", author), ("source", source), 
                           ("category", category), ("license", license_val), ("difficulty", difficulty), ("length", length)]:
            if val is None:
                errors.append(f"[{cat}] Quote at index {idx} lacks field '{field}'")
            elif val == "" and field not in ("author", "source"):
                errors.append(f"[{cat}] Quote at index {idx} lacks field '{field}'")
                
        if q_id != f"{cat}-{idx+1:03d}":
            errors.append(f"[{cat}] Mismatched ID at index {idx}: expected '{cat}-{idx+1:03d}', got '{q_id}'")
            
        if category != cat:
            errors.append(f"[{cat}] Mismatched category value at index {idx}: expected '{cat}', got '{category}'")
            
        # Check length
        if text:
            actual_len = len(text)
            if length != actual_len:
                errors.append(f"[{cat}] Mismatched length for quote '{q_id}': expected {actual_len}, got {length}")
                
            # Check difficulty
            expected_diff = "easy" if actual_len < 80 else ("medium" if actual_len < 150 else "hard")
            if difficulty != expected_diff:
                errors.append(f"[{cat}] Mismatched difficulty for quote '{q_id}': expected '{expected_diff}', got '{difficulty}'")
                
            # Check duplicates
            text_lower = text.strip().lower()
            if text_lower in all_texts:
                orig_cat, orig_id = all_texts[text_lower]
                errors.append(f"Duplicate quote text found: '{q_id}' matches '{orig_id}' in '{orig_cat}'")
            else:
                all_texts[text_lower] = (cat, q_id)

print("-" * 50)
if errors:
    print(f"Validation FAILED! Found {len(errors)} errors:")
    for err in errors[:20]:
        print(f"  - {err}")
    if len(errors) > 20:
        print(f"  ... and {len(errors) - 20} more errors.")
    sys.exit(1)
else:
    print(f"Validation SUCCESSFUL! Audited {total_quotes} quotes across {len(categories)} categories.")
    print("All categories have 200+ quotes, correct schemas, correct lengths/difficulties, and zero duplicates!")
    sys.exit(0)

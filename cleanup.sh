#!/bin/bash
REPORT="cleanup_report.txt"
echo "=== Cleanup Report ===" > $REPORT
echo "Date: $(date)" >> $REPORT
echo "----------------------" >> $REPORT

TOTAL_SIZE=0
FILE_COUNT=0
DIR_COUNT=0

# Clean directories
for d in dist node_modules dist-electron release target build __pycache__ .gradle .m2 .idea .vscode; do
  if [ -d "$d" ]; then
    SIZE=$(du -sk "$d" | cut -f1)
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
    DIR_COUNT=$((DIR_COUNT + 1))
    echo "Deleted Directory: $d ($SIZE KB)" >> $REPORT
    rm -rf "$d"
  fi
done

# Clean files
FILES=$(find . -name ".git" -prune -o -type f \( -name "*.class" -o -name "*.o" -o -name "*.pyc" -o -name "*.obj" -o -name "*.iml" -o -name "*.suo" -o -name "*.log" -o -name "*.tmp" -o -name "*.bak" -o -name "*.swp" -o -name "*.swo" -o -name ".DS_Store" -o -name "Thumbs.db" \) -print)

for f in $FILES; do
  SIZE=$(du -sk "$f" | cut -f1)
  TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
  FILE_COUNT=$((FILE_COUNT + 1))
  
  # Calculate SHA-256
  CHECKSUM=$(shasum -a 256 "$f" | awk '{print $1}')
  echo "Deleted File: $f | SHA256: $CHECKSUM | Size: $SIZE KB" >> $REPORT
  
  rm -f "$f"
done

echo "----------------------" >> $REPORT
echo "Total Directories Deleted: $DIR_COUNT" >> $REPORT
echo "Total Files Deleted (excluding those in dirs): $FILE_COUNT" >> $REPORT
echo "Total Space Freed: $((TOTAL_SIZE / 1024)) MB" >> $REPORT

echo "Cleanup finished. Total Space Freed: $((TOTAL_SIZE / 1024)) MB."
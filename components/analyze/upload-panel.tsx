'use client';

import { useCallback, useRef, useState } from 'react';
import { ClipboardType, FileUp, Loader2, PencilLine, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/lib/parsing';
import { cn } from '@/lib/utils';

export function UploadPanel({
  onFile,
  onText,
  onManual,
  onSample,
  busy,
}: {
  onFile: (file: File) => void;
  onText: (text: string) => void;
  onManual: () => void;
  onSample: () => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <Tabs defaultValue="upload">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-2">
        <TabsTrigger value="upload">
          <FileUp className="h-4 w-4" />
          Upload a file
        </TabsTrigger>
        <TabsTrigger value="paste">
          <ClipboardType className="h-4 w-4" />
          Paste the offer
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload">
        <Card>
          <CardContent className="p-6">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
                dragging ? 'border-primary bg-primary/[0.06]' : 'border-border',
              )}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </span>

              <p className="mt-5 text-base font-medium">
                {busy ? 'Reading the offer…' : 'Drop the supplier offer here'}
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                PDF quotations, CSV and XLSX price lists. Up to {MAX_UPLOAD_BYTES / 1_048_576} MB.
              </p>

              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(file);
                  event.target.value = '';
                }}
              />

              <Button className="mt-6" onClick={() => inputRef.current?.click()} disabled={busy}>
                Choose a file
              </Button>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">No offer to hand?</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onSample} disabled={busy}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Try a sample offer
                </Button>
                <Button variant="ghost" size="sm" onClick={onManual} disabled={busy}>
                  <PencilLine className="h-3.5 w-3.5" />
                  Enter it by hand
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="paste">
        <Card>
          <CardContent className="p-6">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Paste the body of the email or the table from the quote, for example:

Mozzarella 2.5kg block      120    18.40    6%
Olive oil 5L tin             40    41.90    0%
Payment terms: 2/10 net 30
Delivery $145 per drop, free over $5,000`}
              className="min-h-[280px] font-mono text-xs"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Tabs or columns both work — payment terms and delivery charges are picked up too.
              </p>
              <Button onClick={() => onText(text)} disabled={busy || text.trim().length === 0}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Read this offer
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

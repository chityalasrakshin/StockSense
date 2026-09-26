'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DocumentType } from '../schemas';

interface DocumentWizardProps {
  type: DocumentType;
  title: string;
  description: string;
}

export function DocumentWizard({ type, title, description }: DocumentWizardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline">{type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 bg-muted/20">
          <p className="text-sm font-medium">Document Lifecycle Stage</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">1. Draft</span>
            <span>→</span>
            <span>2. Waiting</span>
            <span>→</span>
            <span>3. Ready</span>
            <span>→</span>
            <span>4. Done (Validated to Ledger)</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm">
            Cancel
          </Button>
          <Button size="sm">Create Draft</Button>
        </div>
      </CardContent>
    </Card>
  );
}

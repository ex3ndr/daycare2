import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/ui/card";
import { Separator } from "@/app/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";
import { MessagePhoto } from "@/app/components/messages/MessagePhoto";
import { MessageDocument } from "@/app/components/messages/MessageDocument";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="rounded-lg border bg-background p-6">{children}</div>
    </div>
  );
}

export function DevComponents() {
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">UI Components</h2>
        <p className="text-muted-foreground mt-1">Base component library reference</p>
      </div>

      {/* Button */}
      <Section title="Button">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Variants</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Sizes</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><ChevronDown className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">States</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Badge */}
      <Section title="Badge">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Variants</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Sizes</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="sm">Small</Badge>
              <Badge size="md">Medium</Badge>
            </div>
          </div>
        </div>
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Sizes</p>
            <div className="flex flex-wrap items-end gap-3">
              <Avatar size="xs"><AvatarFallback>XS</AvatarFallback></Avatar>
              <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
              <Avatar size="md"><AvatarFallback>MD</AvatarFallback></Avatar>
              <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Presence</p>
            <div className="flex flex-wrap items-end gap-3">
              <Avatar size="md" presence="online"><AvatarFallback>ON</AvatarFallback></Avatar>
              <Avatar size="md" presence="away"><AvatarFallback>AW</AvatarFallback></Avatar>
              <Avatar size="md" presence="offline"><AvatarFallback>OF</AvatarFallback></Avatar>
            </div>
          </div>
        </div>
      </Section>

      {/* Input */}
      <Section title="Input">
        <div className="space-y-4 max-w-sm">
          <Input placeholder="Default input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
          <Input placeholder="Disabled input" disabled />
        </div>
      </Section>

      {/* Textarea */}
      <Section title="Textarea">
        <div className="space-y-4 max-w-sm">
          <Textarea placeholder="Default textarea" value={textareaValue} onChange={(e) => setTextareaValue(e.target.value)} />
          <Textarea placeholder="Auto-resize textarea" autoResize />
          <Textarea placeholder="Disabled textarea" disabled />
        </div>
      </Section>

      {/* Card */}
      <Section title="Card">
        <div className="max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description text</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Card content goes here.</p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Separator */}
      <Section title="Separator">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Horizontal</p>
            <div className="space-y-2">
              <p className="text-sm">Above</p>
              <Separator />
              <p className="text-sm">Below</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Vertical</p>
            <div className="flex items-center gap-2 h-6">
              <span className="text-sm">Left</span>
              <Separator orientation="vertical" />
              <span className="text-sm">Right</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Tooltip */}
      <Section title="Tooltip">
        <div className="flex gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip content</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Right tooltip</Button>
            </TooltipTrigger>
            <TooltipContent side="right">Right side</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* Dialog */}
      <Section title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>This is a dialog description.</DialogDescription>
            </DialogHeader>
            <p className="text-sm">Dialog body content.</p>
          </DialogContent>
        </Dialog>
      </Section>

      {/* Dropdown Menu */}
      <Section title="Dropdown Menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Open Menu <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Item One</DropdownMenuItem>
            <DropdownMenuItem>Item Two</DropdownMenuItem>
            <DropdownMenuItem>Item Three</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* Scroll Area */}
      <Section title="Scroll Area">
        <ScrollArea className="h-32 w-full rounded-md border p-4">
          <div className="space-y-2">
            {Array.from({ length: 20 }, (_, i) => (
              <p key={i} className="text-sm">Scrollable item {i + 1}</p>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* MessagePhoto */}
      <Section title="MessagePhoto">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Landscape (800x600)</p>
            <MessagePhoto
              url="https://picsum.photos/800/600"
              width={800}
              height={600}
              thumbhash="47sCBYBIaKmGh3h2d3d4gHiPcYBX"
              fileName="landscape-photo.jpg"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Portrait (600x900)</p>
            <MessagePhoto
              url="https://picsum.photos/600/900"
              width={600}
              height={900}
              thumbhash="n4QBBAB4mYhYd4BIeMiIgAhdhw=="
              fileName="portrait-photo.jpg"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Small image (200x150) — no upscaling</p>
            <MessagePhoto
              url="https://picsum.photos/200/150"
              width={200}
              height={150}
              thumbhash="3jgBBwBJWG54eIh0iHeHV3d/t2EI8nYH"
              fileName="small.png"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Wide panoramic (1920x400)</p>
            <MessagePhoto
              url="https://picsum.photos/1920/400"
              width={1920}
              height={400}
              thumbhash="TAcCBIB4eIh4eIhwh3eAeQoAAA=="
              fileName="panorama.jpg"
            />
          </div>
        </div>
      </Section>

      {/* MessageDocument */}
      <Section title="MessageDocument">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">With file name and size</p>
            <MessageDocument url="#" fileName="quarterly-report.pdf" sizeBytes={2_450_000} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Small file</p>
            <MessageDocument url="#" fileName="config.json" sizeBytes={1_280} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">No file name (fallback)</p>
            <MessageDocument url="#" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Long file name (truncation)</p>
            <MessageDocument url="#" fileName="very-long-filename-that-should-be-truncated-in-the-display.xlsx" sizeBytes={15_700_000} />
          </div>
        </div>
      </Section>
    </div>
  );
}

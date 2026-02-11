import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@/app/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
      <Separator />
    </div>
  );
}

function App(): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-3xl space-y-8 p-8">
        <h1 className="font-display text-3xl font-bold">Daycare Component Library</h1>
        <p className="text-muted-foreground">All shadcn/ui components with the Daycare warm palette.</p>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="sm">Primary SM</Button>
            <Button variant="primary" size="md">Primary MD</Button>
            <Button variant="primary" size="lg">Primary LG</Button>
            <Button variant="primary" size="icon">P</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Input & Textarea">
          <Input placeholder="Type something..." />
          <Input disabled placeholder="Disabled input" />
          <Textarea placeholder="Write a message..." />
          <Textarea autoResize placeholder="Auto-resizing textarea..." />
        </Section>

        <Section title="Avatars">
          <div className="flex items-center gap-3">
            <Avatar size="xs"><AvatarFallback>XS</AvatarFallback></Avatar>
            <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
            <Avatar size="md"><AvatarFallback>MD</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
            <Avatar size="md">
              <AvatarImage src="https://api.dicebear.com/9.x/thumbs/svg?seed=daycare" alt="Avatar" />
              <AvatarFallback>DC</AvatarFallback>
            </Avatar>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral" size="sm">Neutral SM</Badge>
            <Badge variant="neutral" size="md">Neutral MD</Badge>
            <Badge variant="accent">Accent</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </Section>

        <Section title="Card">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is the card content area with the warm Daycare palette.</p>
            </CardContent>
            <CardFooter>
              <Button variant="primary" size="sm">Action</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Dialog">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog Title</DialogTitle>
                <DialogDescription>This is a dialog description.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input placeholder="Dialog input field" />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="ScrollArea">
          <ScrollArea className="h-48 w-full rounded-md border p-4">
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i} className="text-sm">Scrollable item {i + 1}</p>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Section title="Tooltip">
          <div className="flex gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">?</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section title="Dropdown Menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Open Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Popover Title</h4>
                <p className="text-sm text-muted-foreground">Popover content goes here.</p>
              </div>
            </PopoverContent>
          </Popover>
        </Section>

        <Section title="Command">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Channels">
                <CommandItem>general</CommandItem>
                <CommandItem>random</CommandItem>
                <CommandItem>engineering</CommandItem>
              </CommandGroup>
              <CommandGroup heading="Users">
                <CommandItem>Alice</CommandItem>
                <CommandItem>Bob</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </Section>

        <Section title="Sidebar & Rail Colors">
          <div className="flex gap-4 rounded-lg overflow-hidden border">
            <div className="w-20 bg-rail p-4 text-rail-foreground text-xs text-center">Rail</div>
            <div className="w-48 bg-sidebar p-4 text-sidebar-foreground text-xs">
              <p className="font-semibold">Sidebar</p>
              <p className="text-sidebar-muted-foreground">Muted text</p>
            </div>
            <div className="flex-1 bg-background p-4 text-foreground text-xs">
              <p className="font-semibold">Content</p>
              <p className="text-muted-foreground">Muted text</p>
            </div>
          </div>
        </Section>
      </div>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import { ChevronRight } from 'lucide-react';
import type { ReactElement } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export function Breadcrumb({ items, label = 'Breadcrumb' }: { items: BreadcrumbItem[]; label?: string }): ReactElement {
  return (
    <nav aria-label={label} className="workspace-breadcrumb" data-slot="breadcrumb">
      <ol data-slot="breadcrumb-list">
        {items.map((item, index) => {
          const current = item.current ?? index === items.length - 1;
          return (
            <li className="breadcrumb-item" key={`${item.label}-${index}`}>
              {index > 0 && <ChevronRight aria-hidden="true" className="breadcrumb-separator" data-slot="breadcrumb-separator" />}
              {current || !item.href
                ? <span aria-current={current ? 'page' : undefined} data-slot="breadcrumb-page">{item.label}</span>
                : <a data-slot="breadcrumb-link" href={item.href}>{item.label}</a>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

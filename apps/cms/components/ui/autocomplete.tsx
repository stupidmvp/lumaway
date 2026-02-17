"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { SearchInput } from "./search-input";
import { useDebounce } from "use-debounce";
import { fetchAPI } from "@/lib/api";
import { useTranslations } from "next-intl";

interface AutocompleteProps {
  value?: number | string;
  onValueChange: (value: number | string, item?: any) => void;
  service: string;
  optionLabel?:
  | string
  | ((label: string, item: any) => React.ReactNode | string);
  renderOptionLabel?: (item: any, open: boolean) => React.ReactNode | string;
  optionValue?: string;
  dataSource?: any[];
  placeholder?: string;
  label?: string | React.ReactElement;
  searchField?: string;
  defaultValue?: any;
  className?: string;
  filterDefaultValues?: Record<string, any>;
  disabled?: boolean;
  autoLoad?: boolean;
  allowClear?: boolean;
  form?: React.ReactElement;
  triggerClassName?: string;
  limit?: number;
  popoverClassName?: string;
  inputClassName?: string;
  onSearchChange?: (term: string) => void;
  emptyStateRender?: (searchTerm: string) => React.ReactNode;
  /** Allow the typed text to be selected as the value when no matching item is found */
  freeSolo?: boolean;
  /** Validate whether the free text is a valid selection (e.g., email format). Only used when freeSolo is true. */
  freeSoloValidator?: (value: string) => boolean;
  /** Custom label for the free text option in the dropdown. Defaults to "Use '{value}'" */
  freeSoloLabel?: (value: string) => React.ReactNode;
}

export function Autocomplete({
  value: propValue,
  onValueChange,
  service,
  optionLabel = "name",
  optionValue = "id",
  dataSource,
  placeholder,
  label,
  triggerClassName,
  searchField = "search",
  defaultValue,
  className,
  filterDefaultValues,
  disabled = false,
  autoLoad = true,
  renderOptionLabel,
  allowClear = true,
  form,
  limit = 10,
  popoverClassName,
  inputClassName,
  onSearchChange,
  emptyStateRender,
  freeSolo = false,
  freeSoloValidator,
  freeSoloLabel,
}: AutocompleteProps) {
  const t = useTranslations('Autocomplete');
  const resolvedPlaceholder = placeholder ?? t('searchPlaceholder');
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [value, setValue] = React.useState<any>(propValue || defaultValue);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<any>(null);
  const [localFilters, setLocalFilters] = React.useState(filterDefaultValues || {});
  const mounted = React.useRef(false);
  const previousFilters = React.useRef(filterDefaultValues);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isFirstLoad = React.useRef(true);
  const lastDefaultFetch = React.useRef<any>(null);
  const hasUserSearched = React.useRef(false);

  // Estado interno para el valor seleccionado
  const [internalValue, setInternalValue] = React.useState<any>(value);

  // Free solo: tracks the free text value when no item is selected
  const [freeSoloValue, setFreeSoloValue] = React.useState<string | null>(null);

  // Refs para controlar comportamiento
  const isSelecting = React.useRef(false);
  const isInternalChange = React.useRef(false);

  // Sync prop value with internal state
  React.useEffect(() => {
    if (propValue !== undefined && propValue !== value) {
      setValue(propValue);
    }
  }, [propValue]);

  // useDebounce para el término de búsqueda
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

  // Definir la función de búsqueda
  const searchFunction = React.useCallback(async (term: string, filters: Record<string, any>) => {
    // No mostrar loading si el cambio es interno
    if (!isInternalChange.current) {
      setLoading(true);
    }

    try {
      if (!autoLoad && Object.keys(filters).length === 0) {
        setItems([]);
        return;
      }

      if (dataSource) {
        const filteredItems = (dataSource || []).filter((item) =>
          item?.[typeof optionLabel === "function" ? "name" : optionLabel]
            ?.toLowerCase()
            .includes(term.toLowerCase())
        );

        setItems(filteredItems);
        return;
      }

      const params = new URLSearchParams();
      params.append('$limit', limit.toString());
      params.append('$sort[' + (typeof optionLabel === "function" ? "createdAt" : optionLabel) + ']', typeof optionLabel === "function" ? "-1" : "1");

      if (term) {
        params.append(searchField, term);
      }

      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          params.append(key, val.toString());
        }
      });

      const response = await fetchAPI(`/${service}?${params.toString()}`);

      if (response) {
        const data = response.data;
        setItems(Array.isArray(data) ? data : response || []);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error(`Error loading ${service}:`, error);
      if (mounted.current) {
        setItems([]);
      }
    } finally {
      if (mounted.current) {
        isInternalChange.current = false;
      }
      setLoading(false);
    }
  }, [autoLoad, dataSource, optionLabel, searchField, service, limit]);

  // Efecto para cambios en filtros externos
  const filtersString = JSON.stringify(filterDefaultValues);
  React.useEffect(() => {
    const filters = filterDefaultValues || {};
    setLocalFilters(filters);

    if (isFirstLoad.current) {
      searchFunction("", filters);
      isFirstLoad.current = false;
    } else {
      searchFunction(searchTerm, filters);
    }
  }, [filtersString, autoLoad, searchFunction]);

  // Efecto para búsqueda debounced — solo cuando el usuario escribe
  React.useEffect(() => {
    if (hasUserSearched.current) {
      hasUserSearched.current = false;
      searchFunction(debouncedSearchTerm, localFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const defaultRenderOptionLabel = (item: any) => {
    if (typeof optionLabel === "function") {
      return optionLabel(
        item[typeof optionValue === "string" ? optionValue : "name"],
        item
      );
    }
    return item[optionLabel];
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    hasUserSearched.current = true;
    setSearchTerm(term);
    onSearchChange?.(term);

    if (isSelecting.current) {
      isSelecting.current = false;
      return;
    }

    if (!term) {
      setSelectedItem(null);
    }
  };
  const getDefaultValue = async (value: any) => {
    if (value !== undefined && value !== null && value !== "") {
      try {
        setLoading(true);
        const response = await fetchAPI(`/${service}/${value}`);
        if (response) {
          const item = response;
          setSelectedItem(item);
          setInternalValue(item[optionValue]);
          const label = defaultRenderOptionLabel(item);
          setSearchTerm(typeof label === "string" ? label : "");
        }
        setLoading(false);
      } catch (error) {
        console.error(`Error loading default value for ${service}:`, error);
        setLoading(false);
      }
    }
  }
  // Sync selectedItem cuando value o items cambian
  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (value !== undefined) {
      const foundItem = items.find((item) => item[optionValue] === value);
      if (foundItem) {
        setSelectedItem(foundItem);
        setInternalValue(value);
        if (!searchTerm && !mounted.current) {
          const label = defaultRenderOptionLabel(foundItem);
          setSearchTerm(typeof label === "string" ? label : "");
        }
      } else if (!foundItem && value) {
        if (lastDefaultFetch.current !== value) {
          lastDefaultFetch.current = value;
          getDefaultValue(value);
        }
      }
      else if (!value && prevValue.current) {
        setSelectedItem(null);
        setFreeSoloValue(null);
        setInternalValue(undefined);
        setSearchTerm("");
        lastDefaultFetch.current = null;
      }
    }
    prevValue.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  const handleSelection = (item: any) => {
    if (!disabled) {
      isInternalChange.current = true; // Marcar que el cambio es interno
      setSelectedItem(item);
      setFreeSoloValue(null); // Clear free solo when a real item is selected
      isSelecting.current = true;
      const label = defaultRenderOptionLabel(item);
      setSearchTerm(typeof label === "string" ? label : "");
      setInternalValue(item[optionValue]);
      if (onValueChange) {
        onValueChange(item[optionValue], item);
      }
      setOpen(false);
    }
  };

  const handleFreeSoloSelection = (text: string) => {
    if (!disabled) {
      const trimmed = text.trim();
      setFreeSoloValue(trimmed);
      setSelectedItem(null);
      isSelecting.current = true;
      setSearchTerm(trimmed);
      setInternalValue(trimmed);
      if (onValueChange) {
        onValueChange(trimmed, undefined);
      }
      setOpen(false);
    }
  };

  // Determine whether to show the free solo option in the dropdown
  const showFreeSoloOption = freeSolo
    && searchTerm.trim().length > 0
    && !loading
    && (!freeSoloValidator || freeSoloValidator(searchTerm.trim()))
    // Don't show if an item with the exact same label already exists
    && !items.some(item => {
      const label = typeof optionLabel === 'string' ? item[optionLabel] : '';
      return typeof label === 'string' && label.toLowerCase() === searchTerm.trim().toLowerCase();
    });

  React.useEffect(() => {
    if (defaultValue && !isFirstLoad.current) {
      setValue(defaultValue);
    }
  }, [defaultValue]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) {
      setSelectedItem(null);
      setFreeSoloValue(null);
      setSearchTerm("");
      setInternalValue(null);
      onSearchChange?.("");
      if (onValueChange) {
        onValueChange("", undefined);
      }
      searchFunction("", localFilters);
    }
  };

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Función para manejar el refresco después del submit
  const handleFormFinish = async () => {
    // Cerrar el popover
    setOpen(false);
    // Refrescar la lista de forma inmediata
    searchFunction(searchTerm, localFilters);
  };

  // Clonar el formulario con el nuevo onFinish
  const formElement = form as React.ReactElement<any>;
  const clonedForm = form
    ? React.cloneElement(formElement, {
      onFinish: async (...args: any[]) => {
        // Llamar al onFinish original si existe
        if (formElement.props.onFinish) {
          await formElement.props.onFinish(...args);
        }
        // Refrescar la lista
        handleFormFinish();
      },
    })
    : null;

  return (
    <div className={cn("w-full", className)}>
      {label && <Label className="mb-1.5">{label}</Label>}
      <div className="flex gap-2 items-center">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal min-w-0",
                !selectedItem && !freeSoloValue && "text-foreground-subtle",
                triggerClassName
              )}
              disabled={disabled}
            >
              <span className="truncate">
                {selectedItem
                  ? renderOptionLabel
                    ? renderOptionLabel(selectedItem, open)
                    : defaultRenderOptionLabel(selectedItem)
                  : freeSoloValue
                    ? freeSoloValue
                    : resolvedPlaceholder}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {allowClear && (selectedItem || freeSoloValue) && (
                  <span
                    role="button"
                    onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={handleClear}
                    className="rounded-sm hover:bg-background-tertiary p-0.5 transition-smooth"
                  >
                    <X className="h-3.5 w-3.5 text-foreground-muted hover:text-foreground" />
                  </span>
                )}
                <ChevronsUpDown className="h-3.5 w-3.5 text-foreground-subtle" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn("p-0 overflow-hidden", popoverClassName)}
            align="start"
            style={{
              width: triggerRef.current?.offsetWidth,
              minWidth: "220px",
            }}
          >
            <div className="flex items-center border-b border-border px-2 py-1.5">
              <SearchInput
                placeholder={resolvedPlaceholder}
                value={searchTerm}
                onChange={handleSearch}
                onClear={() => {
                  setSearchTerm("");
                  setSelectedItem(null);
                  setFreeSoloValue(null);
                  setInternalValue(null);
                  if (onValueChange) {
                    onValueChange("", undefined);
                  }
                  searchFunction("", localFilters);
                }}
                className={cn(
                  "h-7 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm",
                  inputClassName
                )}
                wrapperClassName="flex-1"
                disabled={disabled}
                autoFocus
              />
              {loading && (
                <Loader2 className="h-3.5 w-3.5 text-foreground-subtle animate-spin flex-shrink-0 ml-1.5" />
              )}
            </div>

            <div className={cn(
              "max-h-[240px] overflow-y-auto p-1 transition-smooth",
              loading && items.length > 0 && "opacity-60 pointer-events-none"
            )}>
              {items.length === 0 && !showFreeSoloOption ? (
                <div className="py-6 text-center text-small text-foreground-muted">
                  {loading ? t('searching') : (emptyStateRender ? emptyStateRender(searchTerm) : t('noResults'))}
                </div>
              ) : (
                <>
                  {items.map((item) => (
                    <div
                      key={item[optionValue]}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-smooth",
                        "hover:bg-background-secondary",
                        internalValue === item[optionValue] && !freeSoloValue
                          ? "bg-background-secondary text-foreground font-medium"
                          : "text-foreground",
                        disabled && "pointer-events-none opacity-50"
                      )}
                      onClick={() => handleSelection(item)}
                    >
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 flex-shrink-0 text-primary",
                          internalValue === item[optionValue] && !freeSoloValue
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate flex-1">
                        {renderOptionLabel
                          ? renderOptionLabel(item, open)
                          : defaultRenderOptionLabel(item)}
                      </span>
                    </div>
                  ))}

                  {/* Free solo option — use typed text as value */}
                  {showFreeSoloOption && (
                    <>
                      {items.length > 0 && (
                        <div className="border-t border-border my-1" />
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer transition-smooth",
                          "hover:bg-background-secondary",
                          freeSoloValue === searchTerm.trim()
                            ? "bg-background-secondary text-foreground font-medium"
                            : "text-foreground",
                          disabled && "pointer-events-none opacity-50"
                        )}
                        onClick={() => handleFreeSoloSelection(searchTerm)}
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0 text-primary",
                            freeSoloValue === searchTerm.trim()
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate flex-1">
                          {freeSoloLabel
                            ? freeSoloLabel(searchTerm.trim())
                            : t('useValue', { value: searchTerm.trim() })}
                        </span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {form && (
          <span
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            className="isolate flex-shrink-0"
          >
            {form}
          </span>
        )}
      </div>
    </div>
  );
}

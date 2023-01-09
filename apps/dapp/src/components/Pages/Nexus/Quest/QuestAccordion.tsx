import React, { KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import QuestAccordionItem from './QuestAccordionItem';

interface AccordionItem {
  [name: string | number | symbol]: any;
  id: string | number;
}
interface AccorionProps {
  items: AccordionItem[];
  multiExpand?: boolean;
  SummaryComponent: React.ElementType;
  DetailComponent: React.ElementType;
  [rest: string | number | symbol]: unknown;
}

const Accordion = ({ items, multiExpand = true, ...rest }: AccorionProps) => {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const listContainerRef = useRef<HTMLUListElement>(null);

  const mutationCb: MutationCallback = (list) => {
    // this will get us the 2nd child (detail component)
    const contentItem = (list[0].target.childNodes[1] as HTMLElement) ?? null;

    if (!contentItem) return;
    // only animate the content item class
    if (!contentItem.id.startsWith('acc-content')) return;

    const scrollHeight = contentItem.scrollHeight;

    contentItem.animate(
      { maxHeight: `${scrollHeight}px`, opacity: 1 },
      { duration: 100, easing: 'ease-in', fill: 'forwards' }
    );
  };

  useEffect(() => {
    if (!listContainerRef.current) return;
    // start the observer
    const observer = new MutationObserver(mutationCb);
    observer.observe(listContainerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const closeAccordion = (id: string) => {
    const contentItem = document.getElementById(`acc-content-${id}`);

    if (!contentItem) return;

    contentItem.animate({ maxHeight: 0, opacity: 0 }, { duration: 100, easing: 'ease-out' }).finished.then(() => {
      contentItem.style.display = 'none';

      setOpened((prv) => {
        // make a new copy and delete the id from obj
        // after animation is finished
        const newObj = { ...prv };
        delete newObj[id];
        return newObj;
      });
    });
  };

  const clickHandler = (e: MouseEvent | KeyboardEvent): void => {
    let element = e.target as HTMLElement;

    if (element.parentElement?.tagName === 'LI') {
      element = element.parentElement;
    }

    if (element.tagName !== 'LI') return;

    const id = element.getAttribute('id');

    if (!id) return;

    const isOpen = opened[id];

    if (isOpen) {
      return closeAccordion(id);
    }

    setOpened((prv) => ({ ...prv, [id]: true }));

    if (!multiExpand) {
      const prvAccId = Object.keys(opened)[0];
      closeAccordion(prvAccId);
    }
  };

  const ariaHandler = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      clickHandler(e);
      e.preventDefault();
    }
  };

  return (
    <ul onClick={clickHandler} onKeyPress={ariaHandler} ref={listContainerRef} role="list" style={{ paddingLeft: 0 }}>
      {items.map(({ id, ...data }) => (
        <QuestAccordionItem id={id} key={id} isOpen={opened[id]} {...data} {...rest} />
      ))}
    </ul>
  );
};

export default Accordion;
